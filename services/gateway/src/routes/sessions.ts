import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionState,
} from '../types.js';
import type { Config } from '../config.js';

// In-memory session store (stub)
const sessions = new Map<string, SessionState>();

function generateId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateStubToken(sessionId: string, operatorDid: string, robotId: string): string {
  // Stub: return a placeholder JWT structure
  // Real implementation will sign with Ed25519
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: 'dev-key-1' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: operatorDid,
    aud: robotId,
    sid: sessionId,
    scope: ['teleop:view', 'teleop:control', 'teleop:estop'],
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: `tok_${Math.random().toString(36).slice(2, 10)}`,
  })).toString('base64url');
  const signature = 'stub-signature-not-valid';
  return `${header}.${payload}.${signature}`;
}

export async function sessionRoutes(app: FastifyInstance, config: Config): Promise<void> {
  // POST /v1/sessions - Create a new session
  app.post<{ Body: CreateSessionRequest }>(
    '/v1/sessions',
    async (request: FastifyRequest<{ Body: CreateSessionRequest }>, reply: FastifyReply) => {
      const { robot_id, operator_did, requested_scope } = request.body;

      // Stub: Skip VC verification for now
      // TODO: Implement VC/VP verification (M3-003)

      const sessionId = generateId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000);

      const session: SessionState = {
        session_id: sessionId,
        robot_id,
        operator_did,
        state: 'pending',
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        effective_scope: requested_scope ?? ['teleop:view', 'teleop:control'],
      };

      sessions.set(sessionId, session);

      const response: CreateSessionResponse = {
        session_id: sessionId,
        capability_token: generateStubToken(sessionId, operator_did, robot_id),
        signaling_url: `ws://${request.hostname}/v1/signal`,
        ice_servers: [
          { urls: config.stunUrl },
          {
            urls: config.turnUrl,
            username: 'stub-user',
            credential: 'stub-credential',
          },
        ],
        expires_at: expiresAt.toISOString(),
        effective_scope: session.effective_scope,
        limits: {
          max_control_rate_hz: config.maxControlRateHz,
          max_video_bitrate_kbps: config.maxVideoBitrateKbps,
        },
        policy: {
          policy_id: 'default-policy',
          version: '1.0.0',
          hash: 'stub-hash-not-computed',
        },
      };

      return reply.status(201).send(response);
    }
  );

  // GET /v1/sessions/:session_id - Get session state
  app.get<{ Params: { session_id: string } }>(
    '/v1/sessions/:session_id',
    async (request: FastifyRequest<{ Params: { session_id: string } }>, reply: FastifyReply) => {
      const { session_id } = request.params;
      const session = sessions.get(session_id);

      if (!session) {
        return reply.status(404).send({ error: 'session_not_found', message: 'Session not found' });
      }

      return session;
    }
  );

  // DELETE /v1/sessions/:session_id - Operator-initiated teardown
  app.delete<{ Params: { session_id: string } }>(
    '/v1/sessions/:session_id',
    async (request: FastifyRequest<{ Params: { session_id: string } }>, reply: FastifyReply) => {
      const { session_id } = request.params;
      const session = sessions.get(session_id);

      if (!session) {
        return reply.status(404).send({ error: 'session_not_found', message: 'Session not found' });
      }

      session.state = 'terminated';
      // TODO: Emit SESSION_ENDED audit event
      // TODO: Notify via signaling

      return reply.status(200).send({ session_id, state: 'terminated' });
    }
  );
}

// Export for testing/signaling integration
export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

export function updateSessionState(sessionId: string, state: SessionState['state']): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.state = state;
  return true;
}
