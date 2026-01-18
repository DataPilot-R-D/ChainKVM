import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import { signalingRoutes, notifyRevocation, setTokenRegistry } from '../signaling.js';
import { createTokenRegistry, TokenRegistry } from '../../tokens/index.js';

/** Create a test JWT token with given claims. */
function createTestToken(sessionId: string, jti = `tok_${Date.now()}`): string {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    jti,
    sid: sessionId,
    sub: 'did:key:test',
    aud: 'robot-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const signature = Buffer.from('test-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('signalingRoutes', () => {
  let app: FastifyInstance;
  let serverAddress: string;
  let registry: TokenRegistry;

  /** Register a token in the registry for testing. */
  function registerToken(sessionId: string, jti: string): void {
    registry.register({
      jti,
      sessionId,
      operatorDid: 'did:key:test',
      robotId: 'robot-1',
      expiresAt: new Date(Date.now() + 3600000),
    });
  }

  beforeEach(async () => {
    registry = createTokenRegistry();
    setTokenRegistry(registry);
    app = Fastify({ logger: false });
    await app.register(fastifyWebsocket);
    await app.register(signalingRoutes);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (typeof address === 'object' && address) {
      serverAddress = `ws://127.0.0.1:${address.port}`;
    }
  });

  afterEach(async () => {
    await app.close();
  });

  function createClient(): WebSocket {
    return new WebSocket(`${serverAddress}/v1/signal`);
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

  describe('WebSocket connection', () => {
    it('should accept WebSocket connection', async () => {
      const ws = createClient();
      await waitForOpen(ws);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe('join message', () => {
    it('should confirm join with session_state message', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const jti = 'tok_test1';
      registerToken('test-session-1', jti);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-1',
        role: 'operator',
        token: createTestToken('test-session-1', jti),
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'session_state',
        session_id: 'test-session-1',
        state: 'joined',
      });

      ws.close();
    });

    it('should notify other peers when new peer joins', async () => {
      const ws1 = createClient();
      const ws2 = createClient();
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

      const jti = 'tok_test2';
      registerToken('test-session-2', jti);

      const msg1 = waitForMessage(ws1);
      ws1.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-2',
        role: 'operator',
        token: createTestToken('test-session-2', jti),
      }));
      await msg1;

      const notificationPromise = waitForMessage(ws1);
      const msg2 = waitForMessage(ws2);
      ws2.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-2',
        role: 'robot',
        token: createTestToken('test-session-2', jti),
      }));
      await msg2;

      const notification = await notificationPromise;
      expect(notification).toEqual({
        type: 'session_state',
        session_id: 'test-session-2',
        state: 'robot_joined',
      });

      ws1.close();
      ws2.close();
    });
  });

  describe('offer/answer/ice forwarding', () => {
    it('should forward offer to other peers', async () => {
      const operator = createClient();
      const robot = createClient();
      await Promise.all([waitForOpen(operator), waitForOpen(robot)]);

      const jti = 'tok_test3';
      registerToken('test-session-3', jti);
      const token = createTestToken('test-session-3', jti);

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-3',
        role: 'operator',
        token,
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-3',
        role: 'robot',
        token,
      }));
      await Promise.all([opNotify, robJoin]);

      const robotMessage = waitForMessage(robot);
      operator.send(JSON.stringify({
        type: 'offer',
        session_id: 'test-session-3',
        sdp: 'v=0\r\no=- 1234567890 1 IN IP4 127.0.0.1\r\n',
      }));

      const received = await robotMessage;
      expect(received).toEqual({
        type: 'offer',
        session_id: 'test-session-3',
        sdp: 'v=0\r\no=- 1234567890 1 IN IP4 127.0.0.1\r\n',
      });

      operator.close();
      robot.close();
    });

    it('should forward answer to other peers', async () => {
      const operator = createClient();
      const robot = createClient();
      await Promise.all([waitForOpen(operator), waitForOpen(robot)]);

      const jti = 'tok_test4';
      registerToken('test-session-4', jti);
      const token = createTestToken('test-session-4', jti);

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-4',
        role: 'operator',
        token,
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-4',
        role: 'robot',
        token,
      }));
      await Promise.all([opNotify, robJoin]);

      const operatorMessage = waitForMessage(operator);
      robot.send(JSON.stringify({
        type: 'answer',
        session_id: 'test-session-4',
        sdp: 'v=0\r\no=answer\r\n',
      }));

      const received = await operatorMessage;
      expect(received).toEqual({
        type: 'answer',
        session_id: 'test-session-4',
        sdp: 'v=0\r\no=answer\r\n',
      });

      operator.close();
      robot.close();
    });

    it('should forward ICE candidates to other peers', async () => {
      const operator = createClient();
      const robot = createClient();
      await Promise.all([waitForOpen(operator), waitForOpen(robot)]);

      const jti = 'tok_test5';
      registerToken('test-session-5', jti);
      const token = createTestToken('test-session-5', jti);

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-5',
        role: 'operator',
        token,
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-5',
        role: 'robot',
        token,
      }));
      await Promise.all([opNotify, robJoin]);

      const robotMessage = waitForMessage(robot);
      operator.send(JSON.stringify({
        type: 'ice',
        session_id: 'test-session-5',
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
      }));

      const received = await robotMessage;
      expect(received).toEqual({
        type: 'ice',
        session_id: 'test-session-5',
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
      });

      operator.close();
      robot.close();
    });

    it('should reject offer/answer/ice before joining', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'offer',
        session_id: 'test-session',
        sdp: 'v=0\r\n',
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'not_joined',
        message: 'Must join a session first',
      });

      ws.close();
    });
  });

  describe('leave message', () => {
    it('should notify other peers when peer leaves', async () => {
      const operator = createClient();
      const robot = createClient();
      await Promise.all([waitForOpen(operator), waitForOpen(robot)]);

      const jti = 'tok_test6';
      registerToken('test-session-6', jti);
      const token = createTestToken('test-session-6', jti);

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-6',
        role: 'operator',
        token,
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-6',
        role: 'robot',
        token,
      }));
      await Promise.all([opNotify, robJoin]);

      const operatorMessage = waitForMessage(operator);
      robot.send(JSON.stringify({
        type: 'leave',
        session_id: 'test-session-6',
      }));

      const notification = await operatorMessage;
      expect(notification).toEqual({
        type: 'session_state',
        session_id: 'test-session-6',
        state: 'robot_left',
      });

      operator.close();
      robot.close();
    });
  });

  describe('error handling', () => {
    it('should return error for invalid JSON', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send('not valid json {{{');

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'invalid_json',
        message: 'Failed to parse message',
      });

      ws.close();
    });

    it('should return error for unknown message type', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({ type: 'unknown_type' }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'unknown_type',
        message: 'Unknown message type: unknown_type',
      });

      ws.close();
    });
  });

  describe('connection cleanup', () => {
    it('should notify peers when connection closes', async () => {
      const operator = createClient();
      const robot = createClient();
      await Promise.all([waitForOpen(operator), waitForOpen(robot)]);

      const jti = 'tok_test7';
      registerToken('test-session-7', jti);
      const token = createTestToken('test-session-7', jti);

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-7',
        role: 'operator',
        token,
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-7',
        role: 'robot',
        token,
      }));
      await Promise.all([opNotify, robJoin]);

      const operatorMessage = waitForMessage(operator);
      robot.close();

      const notification = await operatorMessage;
      expect(notification).toEqual({
        type: 'session_state',
        session_id: 'test-session-7',
        state: 'robot_disconnected',
      });

      operator.close();
    });
  });

  describe('authentication', () => {
    it('should reject join without token', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session',
        role: 'operator',
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'missing_token',
        message: 'Token is required',
      });

      ws.close();
    });

    it('should reject join with invalid token format', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session',
        role: 'operator',
        token: 'not-a-jwt',
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'invalid_token',
        message: 'Invalid token format',
      });

      ws.close();
    });

    it('should reject join when token session does not match', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-A',
        role: 'operator',
        token: createTestToken('test-session-B'),
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'session_mismatch',
        message: 'Token session does not match',
      });

      ws.close();
    });

    it('should reject join when token is not registered', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-unregistered',
        role: 'operator',
        token: createTestToken('test-session-unregistered', 'tok_unregistered'),
      }));

      const response = await messagePromise;
      expect(response).toEqual({
        type: 'error',
        code: 'token_invalid',
        message: 'Token is not valid or expired',
      });

      ws.close();
    });

    it('should reject join when token is expired', async () => {
      const ws = createClient();
      await waitForOpen(ws);

      const jti = 'tok_expired';
      registry.register({
        jti,
        sessionId: 'test-session-expired',
        operatorDid: 'did:key:test',
        robotId: 'robot-1',
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-expired',
        role: 'operator',
        token: createTestToken('test-session-expired', jti),
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

describe('notifyRevocation', () => {
  let app: FastifyInstance;
  let serverAddress: string;
  let registry: TokenRegistry;

  beforeEach(async () => {
    registry = createTokenRegistry();
    setTokenRegistry(registry);
    app = Fastify({ logger: false });
    await app.register(fastifyWebsocket);
    await app.register(signalingRoutes);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (typeof address === 'object' && address) {
      serverAddress = `ws://127.0.0.1:${address.port}`;
    }
  });

  afterEach(async () => {
    await app.close();
  });

  it('should broadcast revocation and close connections', async () => {
    const ws = new WebSocket(`${serverAddress}/v1/signal`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    const jti = 'tok_revoke_test';
    registry.register({
      jti,
      sessionId: 'revoke-test-session',
      operatorDid: 'did:key:test',
      robotId: 'robot-1',
      expiresAt: new Date(Date.now() + 3600000),
    });

    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      jti,
      sid: 'revoke-test-session',
      sub: 'did:key:test',
      aud: 'robot-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const signature = Buffer.from('test-signature').toString('base64url');
    const token = `${header}.${payload}.${signature}`;

    const joinMsg = new Promise<unknown>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    ws.send(JSON.stringify({
      type: 'join',
      session_id: 'revoke-test-session',
      role: 'operator',
      token,
    }));
    await joinMsg;

    const messagePromise = new Promise<unknown>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    const closePromise = new Promise<void>((resolve) => ws.once('close', resolve));

    notifyRevocation('revoke-test-session', 'Policy violation');

    const message = await messagePromise;
    expect(message).toEqual({
      type: 'revoked',
      session_id: 'revoke-test-session',
      reason: 'Policy violation',
    });

    await closePromise;
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
