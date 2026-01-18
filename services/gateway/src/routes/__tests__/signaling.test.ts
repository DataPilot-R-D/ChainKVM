import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { notifyRevocation } from '../signaling.js';
import {
  TestContext,
  createTestServer,
  createTestToken,
  createClient,
  waitForOpen,
  waitForMessage,
  joinSession,
  registerToken,
  setupTwoPeers,
} from './signaling-test-utils.js';

describe('signalingRoutes', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await ctx.app.close(); });

  it('should accept WebSocket connection', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  describe('join message', () => {
    it('should confirm join with session_state message', async () => {
      const ws = createClient(ctx.serverAddress);
      await waitForOpen(ws);

      const jti = 'tok_test1';
      registerToken(ctx.registry, 'test-session-1', jti);

      const response = await joinSession(ws, {
        sessionId: 'test-session-1',
        role: 'operator',
        token: createTestToken('test-session-1', jti),
      });

      expect(response).toEqual({
        type: 'session_state',
        session_id: 'test-session-1',
        state: 'joined',
      });

      ws.close();
    });

    it('should notify other peers when new peer joins', async () => {
      const { operator, robot } = await setupTwoPeers(ctx, 'test-session-2');
      operator.close();
      robot.close();
    });
  });

  describe('offer/answer/ice forwarding', () => {
    it('should forward offer to other peers', async () => {
      const { operator, robot } = await setupTwoPeers(ctx, 'test-session-3');

      const robotMessage = waitForMessage(robot);
      operator.send(JSON.stringify({
        type: 'offer',
        session_id: 'test-session-3',
        sdp: 'v=0\r\no=- 1234567890 1 IN IP4 127.0.0.1\r\n',
      }));

      expect(await robotMessage).toEqual({
        type: 'offer',
        session_id: 'test-session-3',
        sdp: 'v=0\r\no=- 1234567890 1 IN IP4 127.0.0.1\r\n',
      });

      operator.close();
      robot.close();
    });

    it('should forward answer to other peers', async () => {
      const { operator, robot } = await setupTwoPeers(ctx, 'test-session-4');

      const operatorMessage = waitForMessage(operator);
      robot.send(JSON.stringify({
        type: 'answer',
        session_id: 'test-session-4',
        sdp: 'v=0\r\no=answer\r\n',
      }));

      expect(await operatorMessage).toEqual({
        type: 'answer',
        session_id: 'test-session-4',
        sdp: 'v=0\r\no=answer\r\n',
      });

      operator.close();
      robot.close();
    });

    it('should forward ICE candidates to other peers', async () => {
      const { operator, robot } = await setupTwoPeers(ctx, 'test-session-5');

      const robotMessage = waitForMessage(robot);
      operator.send(JSON.stringify({
        type: 'ice',
        session_id: 'test-session-5',
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
      }));

      expect(await robotMessage).toEqual({
        type: 'ice',
        session_id: 'test-session-5',
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
      });

      operator.close();
      robot.close();
    });

    it('should reject offer/answer/ice before joining', async () => {
      const ws = createClient(ctx.serverAddress);
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({ type: 'offer', session_id: 'test-session', sdp: 'v=0\r\n' }));

      expect(await messagePromise).toEqual({
        type: 'error',
        code: 'not_joined',
        message: 'Must join a session first',
      });

      ws.close();
    });
  });

  describe('leave message', () => {
    it('should notify other peers when peer leaves', async () => {
      const { operator, robot } = await setupTwoPeers(ctx, 'test-session-6');

      const operatorMessage = waitForMessage(operator);
      robot.send(JSON.stringify({ type: 'leave', session_id: 'test-session-6' }));

      expect(await operatorMessage).toEqual({
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
      const ws = createClient(ctx.serverAddress);
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send('not valid json {{{');

      expect(await messagePromise).toEqual({
        type: 'error',
        code: 'invalid_json',
        message: 'Failed to parse message',
      });

      ws.close();
    });

    it('should return error for unknown message type', async () => {
      const ws = createClient(ctx.serverAddress);
      await waitForOpen(ws);

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({ type: 'unknown_type' }));

      expect(await messagePromise).toEqual({
        type: 'error',
        code: 'unknown_type',
        message: 'Unknown message type: unknown_type',
      });

      ws.close();
    });
  });

  describe('connection cleanup', () => {
    it('should notify peers when connection closes', async () => {
      const { operator, robot } = await setupTwoPeers(ctx, 'test-session-7');

      const operatorMessage = waitForMessage(operator);
      robot.close();

      expect(await operatorMessage).toEqual({
        type: 'session_state',
        session_id: 'test-session-7',
        state: 'robot_disconnected',
      });

      operator.close();
    });
  });
});

describe('notifyRevocation', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await ctx.app.close(); });

  it('should broadcast revocation and close connections', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);

    const jti = 'tok_revoke_test';
    registerToken(ctx.registry, 'revoke-test-session', jti);

    await joinSession(ws, {
      sessionId: 'revoke-test-session',
      role: 'operator',
      token: createTestToken('revoke-test-session', jti),
    });

    const messagePromise = waitForMessage(ws);
    const closePromise = new Promise<void>((resolve) => ws.once('close', resolve));

    notifyRevocation('revoke-test-session', 'Policy violation');

    expect(await messagePromise).toEqual({
      type: 'revoked',
      session_id: 'revoke-test-session',
      reason: 'Policy violation',
    });

    await closePromise;
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
