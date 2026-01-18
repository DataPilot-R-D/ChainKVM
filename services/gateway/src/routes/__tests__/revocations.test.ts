import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import { revocationRoutes, setTokenRegistry as setRevocationTokenRegistry } from '../revocations.js';
import { sessionRoutes, getSession, setTokenGenerator, setTokenRegistry as setSessionTokenRegistry } from '../sessions.js';
import { signalingRoutes, setTokenRegistry as setSignalingTokenRegistry } from '../signaling.js';
import type { Config } from '../../config.js';
import type { CreateRevocationRequest, CreateRevocationResponse, CreateSessionRequest } from '../../types.js';
import { createTokenGenerator, createDevKeyManager, createTokenRegistry, TokenRegistry } from '../../tokens/index.js';

const TEST_ADMIN_KEY = 'test-admin-api-key';

const testConfig: Config = {
  port: 4000,
  host: '0.0.0.0',
  turnUrl: 'turn:localhost:3478',
  turnSecret: 'test-secret',
  stunUrl: 'stun:stun.l.google.com:19302',
  sessionTtlSeconds: 3600,
  maxControlRateHz: 20,
  maxVideoBitrateKbps: 4000,
  adminApiKey: TEST_ADMIN_KEY,
};

// Set up token generator before tests
beforeAll(async () => {
  const keyManager = await createDevKeyManager();
  const tokenGenerator = await createTokenGenerator(
    keyManager.getSigningKey(),
    keyManager.getKeyId()
  );
  setTokenGenerator(tokenGenerator);
});

describe('revocationRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
    await app.register((fastify) => revocationRoutes(fastify, testConfig));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createTestSession(): Promise<string> {
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

    return JSON.parse(response.body).session_id;
  }

  describe('POST /v1/revocations', () => {
    describe('admin authentication', () => {
      it('should return 401 when admin key is missing', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/revocations',
          payload: { session_id: 'test-session', reason: 'Test' },
        });

        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('missing_admin_key');
      });

      it('should return 403 when admin key is invalid', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/revocations',
          headers: { 'X-Admin-API-Key': 'wrong-key' },
          payload: { session_id: 'test-session', reason: 'Test' },
        });

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('invalid_admin_key');
      });
    });

    it('should create a revocation for a session', async () => {
      const sessionId = await createTestSession();

      const request: CreateRevocationRequest = {
        session_id: sessionId,
        reason: 'Policy violation',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const body: CreateRevocationResponse = JSON.parse(response.body);
      expect(body.revocation_id).toMatch(/^rev_/);
      expect(body.affected_sessions).toContain(sessionId);
      expect(body.timestamp).toBeDefined();
    });

    it('should update session state to revoked', async () => {
      const sessionId = await createTestSession();

      await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          session_id: sessionId,
          reason: 'Policy violation',
        },
      });

      const session = getSession(sessionId);
      expect(session?.state).toBe('revoked');
    });

    it('should accept revocation by operator_did', async () => {
      const request: CreateRevocationRequest = {
        operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        reason: 'Account suspended',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const body: CreateRevocationResponse = JSON.parse(response.body);
      expect(body.revocation_id).toMatch(/^rev_/);
    });

    it('should return 400 when neither session_id nor operator_did provided', async () => {
      const request = {
        reason: 'Some reason',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: request,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('invalid_request');
    });

    it('should handle non-existent session gracefully', async () => {
      const request: CreateRevocationRequest = {
        session_id: 'ses_nonexistent_123456',
        reason: 'Policy violation',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const body: CreateRevocationResponse = JSON.parse(response.body);
      expect(body.affected_sessions).toEqual([]);
    });

    it('should include reason in revocation', async () => {
      const sessionId = await createTestSession();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          session_id: sessionId,
          reason: 'Emergency shutdown required',
        },
      });

      const { revocation_id } = JSON.parse(createResponse.body);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/v1/revocations/${revocation_id}`,
      });

      const body = JSON.parse(getResponse.body);
      expect(body.reason).toBe('Emergency shutdown required');
    });
  });

  describe('GET /v1/revocations/:revocation_id', () => {
    it('should retrieve revocation by ID', async () => {
      const sessionId = await createTestSession();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          session_id: sessionId,
          reason: 'Test revocation',
        },
      });

      const { revocation_id } = JSON.parse(createResponse.body);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/v1/revocations/${revocation_id}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.revocation_id).toBe(revocation_id);
      expect(body.session_ids).toContain(sessionId);
      expect(body.reason).toBe('Test revocation');
      expect(body.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent revocation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/revocations/rev_nonexistent_123456',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('revocation_not_found');
    });
  });
});

// Integration tests for revocation with signaling and token registry
describe('revocation integration', () => {
  let app: FastifyInstance;
  let serverAddress: string;
  let registry: TokenRegistry;

  function createTestToken(sessionId: string, jti: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      jti,
      sid: sessionId,
      sub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      aud: 'robot-001',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const signature = Buffer.from('test-signature').toString('base64url');
    return `${header}.${payload}.${signature}`;
  }

  function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      ws.once('open', resolve);
      ws.once('error', reject);
    });
  }

  function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.removeAllListeners('message');
        reject(new Error('Timeout waiting for message'));
      }, timeoutMs);

      ws.once('message', (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
      });

      ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  function waitForClose(ws: WebSocket, timeoutMs = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for close'));
      }, timeoutMs);

      ws.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  beforeEach(async () => {
    registry = createTokenRegistry();
    setSignalingTokenRegistry(registry);
    setRevocationTokenRegistry(registry);
    setSessionTokenRegistry(registry);

    app = Fastify({ logger: false });
    await app.register(fastifyWebsocket);
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
    await app.register((fastify) => revocationRoutes(fastify, testConfig));
    await app.register(signalingRoutes);
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address = app.server.address();
    serverAddress = typeof address === 'object' && address
      ? `ws://127.0.0.1:${address.port}`
      : '';
  });

  afterEach(async () => {
    await app.close();
  });

  describe('revocation triggers signaling notification', () => {
    it('should notify connected peers when session is revoked', async () => {
      const sessionId = 'test-session-revoke';
      const jti = `tok_${sessionId}`;

      registry.register({
        jti,
        sessionId,
        operatorDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        robotId: 'robot-001',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const token = createTestToken(sessionId, jti);

      const ws = new WebSocket(`${serverAddress}/v1/signal`);
      await waitForOpen(ws);

      // Join the session
      ws.send(JSON.stringify({
        type: 'join',
        session_id: sessionId,
        role: 'operator',
        token,
      }));
      await waitForMessage(ws);

      // Set up listener for revocation message
      const revokedMessagePromise = waitForMessage(ws);
      const closePromise = waitForClose(ws);

      // Revoke the session
      await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          session_id: sessionId,
          reason: 'Test revocation',
        },
      });

      // Should receive revoked message
      const revokedMessage = await revokedMessagePromise;
      expect(revokedMessage).toEqual({
        type: 'revoked',
        session_id: sessionId,
        reason: 'Test revocation',
      });

      // Connection should be closed
      await closePromise;
    });

    it('should revoke tokens in registry when session is revoked', async () => {
      const sessionId = 'test-session-token-revoke';
      const jti = `tok_${sessionId}`;

      registry.register({
        jti,
        sessionId,
        operatorDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        robotId: 'robot-001',
        expiresAt: new Date(Date.now() + 3600000),
      });

      expect(registry.isValid(jti)).toBe(true);

      await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          session_id: sessionId,
          reason: 'Token should be revoked',
        },
      });

      expect(registry.isValid(jti)).toBe(false);
    });
  });

  describe('revoked token rejected on signaling join', () => {
    it('should reject join attempt with revoked token', async () => {
      const sessionId = 'test-session-rejected';
      const jti = `tok_${sessionId}`;

      registry.register({
        jti,
        sessionId,
        operatorDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        robotId: 'robot-001',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const token = createTestToken(sessionId, jti);

      // Revoke the token first
      registry.revoke(jti);

      const ws = new WebSocket(`${serverAddress}/v1/signal`);
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: sessionId,
        role: 'operator',
        token,
      }));

      const errorMessage = await messagePromise;
      expect(errorMessage).toEqual({
        type: 'error',
        code: 'token_invalid',
        message: 'Token is not valid or expired',
      });

      ws.close();
    });
  });

  describe('bulk operator revocation', () => {
    it('should revoke all sessions for an operator', async () => {
      const operatorDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const sessionIds = ['bulk-session-1', 'bulk-session-2', 'bulk-session-3'];
      const tokens: { sessionId: string; jti: string; token: string }[] = [];

      // Register multiple sessions for the same operator
      for (const sessionId of sessionIds) {
        const jti = `tok_${sessionId}`;
        registry.register({
          jti,
          sessionId,
          operatorDid,
          robotId: 'robot-001',
          expiresAt: new Date(Date.now() + 3600000),
        });
        tokens.push({ sessionId, jti, token: createTestToken(sessionId, jti) });
      }

      // All tokens should be valid
      for (const t of tokens) {
        expect(registry.isValid(t.jti)).toBe(true);
      }

      // Revoke by operator
      const response = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          operator_did: operatorDid,
          reason: 'Operator suspended',
        },
      });

      expect(response.statusCode).toBe(201);
      const body: CreateRevocationResponse = JSON.parse(response.body);
      expect(body.affected_sessions).toHaveLength(3);
      expect(body.affected_sessions).toEqual(expect.arrayContaining(sessionIds));

      // All tokens should now be invalid
      for (const t of tokens) {
        expect(registry.isValid(t.jti)).toBe(false);
      }
    });

    it('should notify all connected peers when operator is revoked', async () => {
      const operatorDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const sessionIds = ['notify-session-1', 'notify-session-2'];
      const connections: WebSocket[] = [];

      // Set up multiple connected sessions
      for (const sessionId of sessionIds) {
        const jti = `tok_${sessionId}`;
        registry.register({
          jti,
          sessionId,
          operatorDid,
          robotId: 'robot-001',
          expiresAt: new Date(Date.now() + 3600000),
        });

        const token = createTestToken(sessionId, jti);
        const ws = new WebSocket(`${serverAddress}/v1/signal`);
        await waitForOpen(ws);

        ws.send(JSON.stringify({
          type: 'join',
          session_id: sessionId,
          role: 'operator',
          token,
        }));
        await waitForMessage(ws);
        connections.push(ws);
      }

      // Set up listeners for all connections
      const closePromises = connections.map(ws => waitForClose(ws));
      const revokedPromises = connections.map(ws => waitForMessage(ws));

      // Revoke by operator
      await app.inject({
        method: 'POST',
        url: '/v1/revocations',
        headers: { 'X-Admin-API-Key': TEST_ADMIN_KEY },
        payload: {
          operator_did: operatorDid,
          reason: 'Operator suspended',
        },
      });

      // All should receive revoked message
      const messages = await Promise.all(revokedPromises);
      for (const msg of messages) {
        expect(msg).toMatchObject({
          type: 'revoked',
          reason: 'Operator suspended',
        });
      }

      // All connections should be closed
      await Promise.all(closePromises);
    });
  });
});
