/**
 * Integration tests for session creation with policy evaluation and signaling flow.
 * Tests the end-to-end authorization path from credential verification to WebRTC signaling.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import {
  sessionRoutes,
  setTokenGenerator,
  setTokenRegistry,
  setPolicyEvaluator,
  setPolicyStore,
} from '../sessions.js';
import { signalingRoutes, setTokenRegistry as setSignalingRegistry } from '../signaling.js';
import {
  createTokenGenerator,
  createDevKeyManager,
  createTokenRegistry,
  type TokenRegistry,
} from '../../tokens/index.js';
import {
  createPolicyStore,
  createPolicyEvaluator,
  type PolicyRule,
} from '../../policy/index.js';
import type { Config } from '../../config.js';
import type { CreateSessionRequest, CreateSessionResponse } from '../../types.js';
import { createTestVc } from './session-test-utils.js';

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

    ws.once('message', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });

    ws.once('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('session + signaling integration with policy', () => {
  let app: FastifyInstance;
  let serverAddress: string;

  beforeAll(async () => {
    const keyManager = await createDevKeyManager();
    const tokenGenerator = await createTokenGenerator(
      keyManager.getSigningKey(),
      keyManager.getKeyId()
    );
    setTokenGenerator(tokenGenerator);

    tokenRegistry = createTokenRegistry();
    setTokenRegistry(tokenRegistry);
    setSignalingRegistry(tokenRegistry);
  });

  beforeEach(async () => {
    // Create fresh policy store and evaluator for each test
    const policyStore = createPolicyStore();
    const policyEvaluator = createPolicyEvaluator();

    // Configure default policy allowing operators and admins
    const defaultPolicyRules: PolicyRule[] = [
      {
        id: 'allow-operators',
        effect: 'allow',
        priority: 100,
        actions: ['teleop:view', 'teleop:control', 'teleop:estop'],
        conditions: [
          { field: 'credential.role', operator: 'in', value: ['operator', 'admin'] },
        ],
        description: 'Allow operators and admins to control robots',
      },
    ];
    policyStore.create({
      id: 'default-policy',
      name: 'Default Teleoperation Policy',
      rules: defaultPolicyRules,
    });

    setPolicyEvaluator(policyEvaluator);
    setPolicyStore(policyStore);

    app = Fastify({ logger: false });
    await app.register(fastifyWebsocket);
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
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

  describe('authorized session creation with valid credential', () => {
    it('should create session with operator role credential', async () => {
      const validVc = await createTestVc({ role: 'operator' });

      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkTestOperator',
        vc_or_vp: validVc,
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
      expect(body.policy).toBeDefined();
      expect(body.policy.policy_id).toBe('default-policy');
    });

    it('should create session with admin role credential', async () => {
      const validVc = await createTestVc({ role: 'admin' });

      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkTestAdmin',
        vc_or_vp: validVc,
        requested_scope: ['teleop:view', 'teleop:control', 'teleop:estop'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(201);
      const body: CreateSessionResponse = JSON.parse(response.body);
      expect(body.effective_scope).toEqual(['teleop:view', 'teleop:control', 'teleop:estop']);
    });
  });

  describe('policy denial for unauthorized role', () => {
    it('should deny session creation for viewer role', async () => {
      const viewerVc = await createTestVc({ role: 'viewer' });

      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkTestViewer',
        vc_or_vp: viewerVc,
        requested_scope: ['teleop:view'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('policy_denied');
    });

    it('should deny session creation for unknown role', async () => {
      const unknownVc = await createTestVc({ role: 'guest' });

      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkTestGuest',
        vc_or_vp: unknownVc,
        requested_scope: ['teleop:view'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('policy_denied');
    });
  });

  describe('invalid credential handling', () => {
    it('should reject malformed JWT credential', async () => {
      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkTestOperator',
        vc_or_vp: 'not-a-valid-jwt',
        requested_scope: ['teleop:view'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('invalid_credential');
    });

    it('should reject empty credential', async () => {
      const request: CreateSessionRequest = {
        robot_id: 'robot-001',
        operator_did: 'did:key:z6MkTestOperator',
        vc_or_vp: '',
        requested_scope: ['teleop:view'],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: request,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('invalid_credential');
    });
  });

  describe('full flow: session creation to signaling connection', () => {
    it('should allow signaling connection with valid session token', async () => {
      const validVc = await createTestVc({ role: 'operator' });

      // 1. Create session
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: {
          robot_id: 'robot-001',
          operator_did: 'did:key:z6MkTestOperator',
          vc_or_vp: validVc,
          requested_scope: ['teleop:view', 'teleop:control'],
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const session: CreateSessionResponse = JSON.parse(createResponse.body);

      // 2. Connect to signaling
      const ws = new WebSocket(`${serverAddress}/v1/signal`);
      await waitForOpen(ws);

      // 3. Join with valid token
      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: session.session_id,
        role: 'operator',
        token: session.capability_token,
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'session_state',
        session_id: session.session_id,
        state: 'joined',
      });

      ws.close();
    });

    it('should reject signaling connection with forged token', async () => {
      const validVc = await createTestVc({ role: 'operator' });

      // 1. Create legitimate session
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        payload: {
          robot_id: 'robot-001',
          operator_did: 'did:key:z6MkTestOperator',
          vc_or_vp: validVc,
          requested_scope: ['teleop:view'],
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const session: CreateSessionResponse = JSON.parse(createResponse.body);

      // 2. Connect to signaling
      const ws = new WebSocket(`${serverAddress}/v1/signal`);
      await waitForOpen(ws);

      // 3. Try to join with forged token
      const forgedToken = createForgedToken(session.session_id);
      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: session.session_id,
        role: 'operator',
        token: forgedToken,
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'token_invalid',
        message: 'Token is not valid or expired',
      });

      ws.close();
    });
  });
});

/** Create a forged token that looks valid but isn't registered. */
function createForgedToken(sessionId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    jti: 'forged_token_id',
    sid: sessionId,
    sub: 'did:key:attacker',
    aud: 'robot-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const signature = Buffer.from('forged-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}
