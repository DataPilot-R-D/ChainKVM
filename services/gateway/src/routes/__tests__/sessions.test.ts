import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  sessionRoutes,
  getSession,
  updateSessionState,
  setTokenGenerator,
  setTokenRegistry,
} from '../sessions.js';
import type { Config } from '../../config.js';
import type { CreateSessionRequest, CreateSessionResponse, SessionState } from '../../types.js';
import {
  createTokenGenerator,
  createDevKeyManager,
  createTokenRegistry,
  type TokenRegistry,
} from '../../tokens/index.js';

const testConfig: Config = {
  port: 4000,
  host: '0.0.0.0',
  turnUrl: 'turn:localhost:3478',
  turnSecret: 'test-secret',
  stunUrl: 'stun:stun.l.google.com:19302',
  sessionTtlSeconds: 3600,
  maxControlRateHz: 20,
  maxVideoBitrateKbps: 4000,
  adminApiKey: 'test-admin-key',
};

let tokenRegistry: TokenRegistry;

// Set up token generator and registry before tests
beforeAll(async () => {
  const keyManager = await createDevKeyManager();
  const tokenGenerator = await createTokenGenerator(
    keyManager.getSigningKey(),
    keyManager.getKeyId()
  );
  setTokenGenerator(tokenGenerator);

  tokenRegistry = createTokenRegistry();
  setTokenRegistry(tokenRegistry);
});

describe('sessionRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/sessions', () => {
    it('should create a new session with valid request', async () => {
      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view', 'teleop:control'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const body: CreateSessionResponse = JSON.parse(response.body);
      expect(body.session_id).toMatch(/^ses_/);
      expect(body.capability_token).toBeDefined();
      expect(body.signaling_url).toContain('/v1/signal');
      expect(body.ice_servers).toHaveLength(2);
      expect(body.expires_at).toBeDefined();
      expect(body.effective_scope).toEqual(['teleop:view', 'teleop:control']);
      expect(body.limits.max_control_rate_hz).toBe(20);
      expect(body.limits.max_video_bitrate_kbps).toBe(4000);
    });

    it('should generate JWT-like capability token', async () => {
      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      const body: CreateSessionResponse = JSON.parse(response.body);
      const tokenParts = body.capability_token.split('.');
      expect(tokenParts).toHaveLength(3);

      const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      expect(header.alg).toBe('EdDSA');
      expect(header.typ).toBe('JWT');
    });

    it('should use default scope when not provided', async () => {
      const request = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const body: CreateSessionResponse = JSON.parse(response.body);
      expect(body.effective_scope).toEqual(['teleop:view', 'teleop:control']);
    });

    it('should include ICE servers with STUN and TURN', async () => {
      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      const body: CreateSessionResponse = JSON.parse(response.body);
      expect(body.ice_servers[0].urls).toBe(testConfig.stunUrl);
      expect(body.ice_servers[1].urls).toBe(testConfig.turnUrl);
      expect(body.ice_servers[1].username).toBeDefined();
      expect(body.ice_servers[1].credential).toBeDefined();
    });

    it('should set expiration based on config TTL', async () => {
      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      };

      const beforeRequest = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      const body: CreateSessionResponse = JSON.parse(response.body);
      const expiresAt = new Date(body.expires_at).getTime();
      const expectedExpiry = beforeRequest + testConfig.sessionTtlSeconds * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe('GET /v1/sessions/:session_id', () => {
    it('should retrieve an existing session', async () => {
      const createRequest: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view', 'teleop:control'],
      };

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: createRequest,
      });
      const { session_id } = JSON.parse(createResponse.body);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/v1/sessions/${session_id}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const session: SessionState = JSON.parse(getResponse.body);
      expect(session.session_id).toBe(session_id);
      expect(session.robot_id).toBe('robot-001');
      expect(session.operator_did).toBe('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
      expect(session.state).toBe('pending');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/sessions/ses_nonexistent_123456',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('session_not_found');
    });
  });

  describe('DELETE /v1/sessions/:session_id', () => {
    it('should terminate an existing session', async () => {
      const createRequest: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      };

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: createRequest,
      });
      const { session_id } = JSON.parse(createResponse.body);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/sessions/${session_id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.session_id).toBe(session_id);
      expect(body.state).toBe('terminated');
    });

    it('should update session state to terminated', async () => {
      const createRequest: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      };

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: createRequest,
      });
      const { session_id } = JSON.parse(createResponse.body);

      await app.inject({
        method: 'DELETE',
        url: `/v1/sessions/${session_id}`,
      });

      const getResponse = await app.inject({
        method: 'GET',
        url: `/v1/sessions/${session_id}`,
      });

      const session: SessionState = JSON.parse(getResponse.body);
      expect(session.state).toBe('terminated');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/sessions/ses_nonexistent_123456',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('session_not_found');
    });
  });
});

describe('session helper functions', () => {
  let app: FastifyInstance;
  let sessionId: string;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
    await app.ready();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      },
    });
    sessionId = JSON.parse(createResponse.body).session_id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      const session = getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.session_id).toBe(sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const session = getSession('ses_nonexistent');
      expect(session).toBeUndefined();
    });
  });

  describe('updateSessionState', () => {
    it('should update session state', () => {
      const updated = updateSessionState(sessionId, 'active');
      expect(updated).toBe(true);

      const session = getSession(sessionId);
      expect(session?.state).toBe('active');
    });

    it('should return false for non-existent session', () => {
      const updated = updateSessionState('ses_nonexistent', 'active');
      expect(updated).toBe(false);
    });
  });
});

describe('POST /v1/sessions/:session_id/refresh', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should refresh token for valid session with valid token', async () => {
    // Create session first
    const createRequest: CreateSessionRequest = {
      robot_id: 'robot-001',
      operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      vc_or_vp: 'stub-vc-token',
      requested_scope: ['teleop:view', 'teleop:control'],
    };

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: createRequest,
    });
    const created: CreateSessionResponse = JSON.parse(createResponse.body);

    // Refresh the token
    const refreshResponse = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${created.session_id}/refresh`,
      headers: {
        authorization: `Bearer ${created.capability_token}`,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const body = JSON.parse(refreshResponse.body);
    expect(body.capability_token).toBeDefined();
    expect(body.capability_token).not.toBe(created.capability_token);
    expect(body.expires_at).toBeDefined();
    expect(body.session_id).toBe(created.session_id);
  });

  it('should return 404 for non-existent session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/ses_nonexistent/refresh',
      headers: {
        authorization: 'Bearer some-token',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('session_not_found');
  });

  it('should return 401 without authorization header', async () => {
    // Create session first
    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      },
    });
    const { session_id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session_id}/refresh`,
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('missing_authorization');
  });

  it('should return 403 for revoked session', async () => {
    // Create session first
    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      },
    });
    const created: CreateSessionResponse = JSON.parse(createResponse.body);

    // Terminate the session
    await app.inject({
      method: 'DELETE',
      url: `/v1/sessions/${created.session_id}`,
    });

    // Try to refresh
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${created.session_id}/refresh`,
      headers: {
        authorization: `Bearer ${created.capability_token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('session_not_active');
  });

  it('should return 403 for token from different session', async () => {
    // Create two sessions
    const session1Response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      },
    });
    const session1: CreateSessionResponse = JSON.parse(session1Response.body);

    const session2Response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        robot_id: 'robot-002',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      },
    });
    const session2: CreateSessionResponse = JSON.parse(session2Response.body);

    // Try to refresh session1 with session2's token
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session1.session_id}/refresh`,
      headers: {
        authorization: `Bearer ${session2.capability_token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('invalid_token');
  });

  it('should provide valid expiry time with new token', async () => {
    const beforeCreate = Date.now();

    // Create session
    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        vc_or_vp: 'stub-vc-token',
        requested_scope: ['teleop:view'],
      },
    });
    const created: CreateSessionResponse = JSON.parse(createResponse.body);

    // Refresh
    const refreshResponse = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${created.session_id}/refresh`,
      headers: {
        authorization: `Bearer ${created.capability_token}`,
      },
    });

    const body = JSON.parse(refreshResponse.body);
    const newExpiry = new Date(body.expires_at).getTime();

    // New expiry should be in the future (at least TTL from now minus some buffer)
    const expectedMinExpiry = beforeCreate + (testConfig.sessionTtlSeconds - 1) * 1000;
    expect(newExpiry).toBeGreaterThanOrEqual(expectedMinExpiry);
  });
});
