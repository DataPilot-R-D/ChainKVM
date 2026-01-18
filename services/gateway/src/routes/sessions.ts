import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionState,
  RefreshTokenResponse,
} from '../types.js';
import type { Config } from '../config.js';
import type { TokenGenerator, TokenRegistry } from '../tokens/index.js';

// In-memory session store (stub)
const sessions = new Map<string, SessionState>();

// Module-level dependencies (set via setters)
let tokenGenerator: TokenGenerator | null = null;
let tokenRegistry: TokenRegistry | null = null;

function generateId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Set the token generator. Call before registering routes. */
export function setTokenGenerator(generator: TokenGenerator): void {
  tokenGenerator = generator;
}

/** Set the token registry. Call before registering routes. */
export function setTokenRegistry(registry: TokenRegistry): void {
  tokenRegistry = registry;
}

export async function sessionRoutes(app: FastifyInstance, config: Config): Promise<void> {
  // POST /v1/sessions - Create a new session
  app.post<{ Body: CreateSessionRequest }>(
    '/v1/sessions',
    async (request: FastifyRequest<{ Body: CreateSessionRequest }>, reply: FastifyReply) => {
      const { robot_id, operator_did, requested_scope } = request.body;

      if (!tokenGenerator) {
        return reply.status(500).send({
          error: 'token_generator_not_configured',
          message: 'Token generator not initialized',
        });
      }

      const sessionId = generateId();
      const effectiveScope = requested_scope ?? ['teleop:view', 'teleop:control'];

      const tokenResult = await tokenGenerator.generate({
        operatorDid: operator_did,
        robotId: robot_id,
        sessionId,
        allowedActions: effectiveScope,
        ttlSeconds: config.sessionTtlSeconds,
      });

      // Register token in registry for tracking
      tokenRegistry?.register({
        jti: tokenResult.tokenId,
        sessionId,
        operatorDid: operator_did,
        robotId: robot_id,
        expiresAt: tokenResult.expiresAt,
      });

      const session: SessionState = {
        session_id: sessionId,
        robot_id,
        operator_did,
        state: 'pending',
        created_at: new Date().toISOString(),
        expires_at: tokenResult.expiresAt.toISOString(),
        effective_scope: effectiveScope,
      };

      sessions.set(sessionId, session);

      const response: CreateSessionResponse = {
        session_id: sessionId,
        capability_token: tokenResult.token,
        signaling_url: `ws://${request.hostname}/v1/signal`,
        ice_servers: [
          { urls: config.stunUrl },
          { urls: config.turnUrl, username: 'stub-user', credential: 'stub-credential' },
        ],
        expires_at: tokenResult.expiresAt.toISOString(),
        effective_scope: effectiveScope,
        limits: {
          max_control_rate_hz: config.maxControlRateHz,
          max_video_bitrate_kbps: config.maxVideoBitrateKbps,
        },
        policy: { policy_id: 'default-policy', version: '1.0.0', hash: 'stub-hash-not-computed' },
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
      tokenRegistry?.revokeBySession(session_id);

      return reply.status(200).send({ session_id, state: 'terminated' });
    }
  );

  // POST /v1/sessions/:session_id/refresh - Refresh token
  app.post<{ Params: { session_id: string } }>(
    '/v1/sessions/:session_id/refresh',
    async (request: FastifyRequest<{ Params: { session_id: string } }>, reply: FastifyReply) => {
      const { session_id } = request.params;
      const authHeader = request.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        return reply
          .status(401)
          .send({ error: 'missing_authorization', message: 'Authorization header required' });
      }

      const session = sessions.get(session_id);
      if (!session) {
        return reply.status(404).send({ error: 'session_not_found', message: 'Session not found' });
      }

      if (session.state !== 'pending' && session.state !== 'active') {
        return reply
          .status(403)
          .send({ error: 'session_not_active', message: 'Session is not active' });
      }

      if (!tokenGenerator) {
        return reply.status(500).send({
          error: 'token_generator_not_configured',
          message: 'Token generator not initialized',
        });
      }

      // Revoke old tokens for this session
      tokenRegistry?.revokeBySession(session_id);

      // Generate new token
      const tokenResult = await tokenGenerator.generate({
        operatorDid: session.operator_did,
        robotId: session.robot_id,
        sessionId: session_id,
        allowedActions: session.effective_scope,
        ttlSeconds: config.sessionTtlSeconds,
      });

      // Register new token
      tokenRegistry?.register({
        jti: tokenResult.tokenId,
        sessionId: session_id,
        operatorDid: session.operator_did,
        robotId: session.robot_id,
        expiresAt: tokenResult.expiresAt,
      });

      // Update session expiry
      session.expires_at = tokenResult.expiresAt.toISOString();

      const response: RefreshTokenResponse = {
        session_id,
        capability_token: tokenResult.token,
        expires_at: tokenResult.expiresAt.toISOString(),
      };

      return reply.status(200).send(response);
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
