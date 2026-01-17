import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CreateRevocationRequest, CreateRevocationResponse } from '../types.js';
import { updateSessionState } from './sessions.js';

// In-memory revocation store (stub)
const revocations = new Map<string, { session_ids: string[]; reason: string; timestamp: string }>();

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
        const updated = updateSessionState(session_id, 'revoked');
        if (updated) {
          affectedSessions.push(session_id);
        }
      }

      if (operator_did) {
        // TODO: Find and revoke all sessions for this operator
        // For stub, we just note that this would be implemented
        request.log.info({ operator_did }, 'Would revoke all sessions for operator');
      }

      const timestamp = new Date().toISOString();

      revocations.set(revocationId, {
        session_ids: affectedSessions,
        reason,
        timestamp,
      });

      // TODO: Emit SESSION_REVOKED audit event (async to Fabric)
      // TODO: Push revocation to peers via signaling WebSocket

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
