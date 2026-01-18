import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CreateRevocationRequest, CreateRevocationResponse } from '../types.js';
import type { Config } from '../config.js';
import type { TokenRegistry } from '../tokens/index.js';
import { updateSessionState } from './sessions.js';
import { notifyRevocation } from './signaling.js';
import { requireAdminAuth } from './admin-auth.js';

// In-memory revocation store (stub)
const revocations = new Map<string, { session_ids: string[]; reason: string; timestamp: string }>();

let tokenRegistry: TokenRegistry | null = null;

export function setTokenRegistry(registry: TokenRegistry): void {
  tokenRegistry = registry;
}

function generateRevocationId(): string {
  return `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Revoke a single session and its tokens. Returns true if session was affected. */
function revokeSession(sessionId: string, reason: string): boolean {
  const sessionUpdated = updateSessionState(sessionId, 'revoked');

  if (!tokenRegistry) {
    console.warn('[REVOCATION] Token registry not configured - token revocation skipped', { sessionId });
  }
  const tokensRevoked = tokenRegistry?.revokeBySession(sessionId) ?? 0;

  if (sessionUpdated || tokensRevoked > 0) {
    notifyRevocation(sessionId, reason);
    return true;
  }
  return false;
}

/** Revoke all sessions for an operator. Returns array of affected session IDs. */
function revokeOperatorSessions(operatorDid: string, reason: string): string[] {
  if (!tokenRegistry) {
    console.warn('[REVOCATION] Token registry not configured - operator revocation skipped', { operatorDid });
    return [];
  }

  const revokedSessionIds = tokenRegistry.revokeByOperator(operatorDid);
  for (const sid of revokedSessionIds) {
    updateSessionState(sid, 'revoked');
    notifyRevocation(sid, reason);
  }
  return revokedSessionIds;
}

/** Store revocation record and return response. */
function storeRevocation(
  revocationId: string,
  affectedSessions: string[],
  reason: string
): CreateRevocationResponse {
  const timestamp = new Date().toISOString();
  revocations.set(revocationId, { session_ids: affectedSessions, reason, timestamp });
  return { revocation_id: revocationId, affected_sessions: affectedSessions, timestamp };
}

export async function revocationRoutes(app: FastifyInstance, config: Config): Promise<void> {
  app.post<{ Body: CreateRevocationRequest }>(
    '/v1/revocations',
    async (request: FastifyRequest<{ Body: CreateRevocationRequest }>, reply: FastifyReply) => {
      if (!requireAdminAuth(request, reply, config)) return reply;

      const { session_id, operator_did, reason } = request.body;
      if (!session_id && !operator_did) {
        return reply.status(400).send({ error: 'invalid_request', message: 'Must provide session_id or operator_did' });
      }

      const affectedSessions: string[] = [];

      if (session_id && revokeSession(session_id, reason)) {
        affectedSessions.push(session_id);
      }

      if (operator_did) {
        affectedSessions.push(...revokeOperatorSessions(operator_did, reason));
      }

      const revocationId = generateRevocationId();
      const response = storeRevocation(revocationId, affectedSessions, reason);

      console.info('[AUDIT] SESSION_REVOKED', { revocation_id: revocationId, affected_sessions: affectedSessions, reason });
      return reply.status(201).send(response);
    }
  );

  app.get<{ Params: { revocation_id: string } }>(
    '/v1/revocations/:revocation_id',
    async (request: FastifyRequest<{ Params: { revocation_id: string } }>, reply: FastifyReply) => {
      const revocation = revocations.get(request.params.revocation_id);
      if (!revocation) {
        return reply.status(404).send({ error: 'revocation_not_found', message: 'Revocation not found' });
      }
      return { revocation_id: request.params.revocation_id, ...revocation };
    }
  );
}
