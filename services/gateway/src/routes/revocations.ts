import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CreateRevocationRequest, CreateRevocationResponse } from '../types.js';
import type { TokenRegistry } from '../tokens/index.js';
import { updateSessionState } from './sessions.js';
import { notifyRevocation } from './signaling.js';

// In-memory revocation store (stub)
const revocations = new Map<string, { session_ids: string[]; reason: string; timestamp: string }>();

let tokenRegistry: TokenRegistry | null = null;

export function setTokenRegistry(registry: TokenRegistry): void {
  tokenRegistry = registry;
}

function generateRevocationId(): string {
  return `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function revocationRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/revocations - Admin revocation
  app.post<{ Body: CreateRevocationRequest }>(
    '/v1/revocations',
    async (request: FastifyRequest<{ Body: CreateRevocationRequest }>, reply: FastifyReply) => {
      const { session_id, operator_did, reason } = request.body;

      if (!session_id && !operator_did) {
        return reply.status(400).send({
          error: 'invalid_request',
          message: 'Must provide session_id or operator_did',
        });
      }

      const revocationId = generateRevocationId();
      const affectedSessions: string[] = [];

      if (session_id) {
        // Revoke specific session
        const sessionUpdated = updateSessionState(session_id, 'revoked');
        // Revoke all tokens for this session
        const tokensRevoked = tokenRegistry?.revokeBySession(session_id) ?? 0;
        // Session is affected if either session state was updated or tokens were revoked
        if (sessionUpdated || tokensRevoked > 0) {
          affectedSessions.push(session_id);
          // Notify connected peers via signaling
          notifyRevocation(session_id, reason);
        }
      }

      if (operator_did) {
        // Find and revoke all sessions for this operator
        if (tokenRegistry) {
          const revokedSessionIds = tokenRegistry.revokeByOperator(operator_did);
          for (const sid of revokedSessionIds) {
            updateSessionState(sid, 'revoked');
            affectedSessions.push(sid);
            // Notify connected peers via signaling
            notifyRevocation(sid, reason);
          }
          request.log.info({ operator_did, sessions: revokedSessionIds.length }, 'Revoked all sessions for operator');
        }
      }

      const timestamp = new Date().toISOString();

      revocations.set(revocationId, {
        session_ids: affectedSessions,
        reason,
        timestamp,
      });

      // Stub: Emit SESSION_REVOKED audit event (async to Fabric in M4)
      request.log.info({
        event_type: 'SESSION_REVOKED',
        revocation_id: revocationId,
        affected_sessions: affectedSessions,
        reason,
      }, 'Audit event: SESSION_REVOKED (stub - Fabric integration in M4)');

      const response: CreateRevocationResponse = {
        revocation_id: revocationId,
        affected_sessions: affectedSessions,
        timestamp,
      };

      return reply.status(201).send(response);
    }
  );

  // GET /v1/revocations/:revocation_id - Get revocation details
  app.get<{ Params: { revocation_id: string } }>(
    '/v1/revocations/:revocation_id',
    async (request: FastifyRequest<{ Params: { revocation_id: string } }>, reply: FastifyReply) => {
      const { revocation_id } = request.params;
      const revocation = revocations.get(revocation_id);

      if (!revocation) {
        return reply.status(404).send({
          error: 'revocation_not_found',
          message: 'Revocation not found',
        });
      }

      return {
        revocation_id,
        ...revocation,
      };
    }
  );
}
