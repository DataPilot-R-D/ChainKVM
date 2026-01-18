import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionState,
  RefreshTokenResponse,
} from '../types.js';
import type { Config } from '../config.js';
import type { TokenGenerator, TokenRegistry, TokenEntry } from '../tokens/index.js';
import type { PolicyEvaluator, PolicyStore } from '../policy/index.js';
import { evaluateSessionPolicy, isTokenValidForSession, type PolicyEvaluationSuccess } from './session-policy.js';

const sessions = new Map<string, SessionState>();
let tokenGenerator: TokenGenerator | null = null;
let tokenRegistry: TokenRegistry | null = null;
let policyEvaluator: PolicyEvaluator | null = null;
let policyStore: PolicyStore | null = null;

function generateId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function registerToken(entry: Omit<TokenEntry, 'jti'> & { jti: string }): void {
  tokenRegistry?.register(entry);
}

export function setTokenGenerator(generator: TokenGenerator): void {
  tokenGenerator = generator;
}

export function setTokenRegistry(registry: TokenRegistry): void {
  tokenRegistry = registry;
}

export function setPolicyEvaluator(evaluator: PolicyEvaluator): void {
  policyEvaluator = evaluator;
}

export function setPolicyStore(store: PolicyStore): void {
  policyStore = store;
}

interface TokenResult {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

/** Build session creation response. */
function buildSessionResponse(
  sessionId: string,
  tokenResult: TokenResult,
  hostname: string,
  config: Config,
  effectiveScope: string[],
  policyResult: PolicyEvaluationSuccess['policyResult']
): CreateSessionResponse {
  return {
    session_id: sessionId,
    capability_token: tokenResult.token,
    signaling_url: `ws://${hostname}/v1/signal`,
    ice_servers: [
      { urls: config.stunUrl },
      { urls: config.turnUrl, username: 'stub-user', credential: 'stub-credential' },
    ],
    expires_at: tokenResult.expiresAt.toISOString(),
    effective_scope: effectiveScope,
    limits: { max_control_rate_hz: config.maxControlRateHz, max_video_bitrate_kbps: config.maxVideoBitrateKbps },
    policy: policyResult,
  };
}

/** Create and store a new session. */
function createSession(
  sessionId: string,
  robotId: string,
  operatorDid: string,
  effectiveScope: string[],
  expiresAt: Date
): SessionState {
  const session: SessionState = {
    session_id: sessionId,
    robot_id: robotId,
    operator_did: operatorDid,
    state: 'pending',
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    effective_scope: effectiveScope,
  };
  sessions.set(sessionId, session);
  return session;
}

/** Extract and validate bearer token from auth header. */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export async function sessionRoutes(app: FastifyInstance, config: Config): Promise<void> {
  app.post<{ Body: CreateSessionRequest }>(
    '/v1/sessions',
    async (request: FastifyRequest<{ Body: CreateSessionRequest }>, reply: FastifyReply) => {
      const { robot_id, operator_did, vc_or_vp, requested_scope } = request.body;
      if (!tokenGenerator) {
        return reply.status(500).send({ error: 'token_generator_not_configured', message: 'Token generator not initialized' });
      }

      const effectiveScope = requested_scope ?? ['teleop:view', 'teleop:control'];
      const policyCheck = evaluateSessionPolicy({ vcOrVp: vc_or_vp, robotId: robot_id, requestedScope: effectiveScope }, policyEvaluator, policyStore);
      if (!policyCheck.success) return reply.status(policyCheck.error.status).send(policyCheck.error.body);

      const sessionId = generateId();
      const tokenResult = await tokenGenerator.generate({ operatorDid: operator_did, robotId: robot_id, sessionId, allowedActions: effectiveScope, ttlSeconds: config.sessionTtlSeconds });
      registerToken({ jti: tokenResult.tokenId, sessionId, operatorDid: operator_did, robotId: robot_id, expiresAt: tokenResult.expiresAt });
      createSession(sessionId, robot_id, operator_did, effectiveScope, tokenResult.expiresAt);

      return reply.status(201).send(buildSessionResponse(sessionId, tokenResult, request.hostname, config, effectiveScope, policyCheck.policyResult));
    }
  );

  app.get<{ Params: { session_id: string } }>(
    '/v1/sessions/:session_id',
    async (request: FastifyRequest<{ Params: { session_id: string } }>, reply: FastifyReply) => {
      const session = sessions.get(request.params.session_id);
      if (!session) return reply.status(404).send({ error: 'session_not_found', message: 'Session not found' });
      return session;
    }
  );

  app.delete<{ Params: { session_id: string } }>(
    '/v1/sessions/:session_id',
    async (request: FastifyRequest<{ Params: { session_id: string } }>, reply: FastifyReply) => {
      const { session_id } = request.params;
      const session = sessions.get(session_id);
      if (!session) return reply.status(404).send({ error: 'session_not_found', message: 'Session not found' });
      session.state = 'terminated';
      tokenRegistry?.revokeBySession(session_id);
      return reply.status(200).send({ session_id, state: 'terminated' });
    }
  );

  app.post<{ Params: { session_id: string } }>(
    '/v1/sessions/:session_id/refresh',
    async (request: FastifyRequest<{ Params: { session_id: string } }>, reply: FastifyReply) => {
      const { session_id } = request.params;
      const bearerToken = extractBearerToken(request.headers.authorization);
      if (!bearerToken) return reply.status(401).send({ error: 'missing_authorization', message: 'Authorization header required' });

      const session = sessions.get(session_id);
      if (!session) return reply.status(404).send({ error: 'session_not_found', message: 'Session not found' });
      if (session.state !== 'pending' && session.state !== 'active') {
        return reply.status(403).send({ error: 'session_not_active', message: 'Session is not active' });
      }
      if (!isTokenValidForSession(bearerToken, session_id, tokenRegistry)) {
        return reply.status(403).send({ error: 'invalid_token', message: 'Token is not valid for this session' });
      }
      if (!tokenGenerator) return reply.status(500).send({ error: 'token_generator_not_configured', message: 'Token generator not initialized' });

      tokenRegistry?.revokeBySession(session_id);
      const tokenResult = await tokenGenerator.generate({ operatorDid: session.operator_did, robotId: session.robot_id, sessionId: session_id, allowedActions: session.effective_scope, ttlSeconds: config.sessionTtlSeconds });
      registerToken({ jti: tokenResult.tokenId, sessionId: session_id, operatorDid: session.operator_did, robotId: session.robot_id, expiresAt: tokenResult.expiresAt });
      session.expires_at = tokenResult.expiresAt.toISOString();

      const response: RefreshTokenResponse = { session_id, capability_token: tokenResult.token, expires_at: tokenResult.expiresAt.toISOString() };
      return reply.status(200).send(response);
    }
  );
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

export function updateSessionState(sessionId: string, state: SessionState['state']): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.state = state;
  return true;
}
