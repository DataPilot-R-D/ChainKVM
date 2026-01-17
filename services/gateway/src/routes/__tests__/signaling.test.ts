import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import { signalingRoutes, notifyRevocation } from '../signaling.js';

describe('signalingRoutes', () => {
  let app: FastifyInstance;
  let serverAddress: string;

  beforeEach(async () => {
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

      const messagePromise = waitForMessage(ws);
      ws.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-1',
        role: 'operator',
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

      const msg1 = waitForMessage(ws1);
      ws1.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-2',
        role: 'operator',
      }));
      await msg1;

      const notificationPromise = waitForMessage(ws1);
      const msg2 = waitForMessage(ws2);
      ws2.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-2',
        role: 'robot',
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

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-3',
        role: 'operator',
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-3',
        role: 'robot',
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

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-4',
        role: 'operator',
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-4',
        role: 'robot',
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

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-5',
        role: 'operator',
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-5',
        role: 'robot',
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

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-6',
        role: 'operator',
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-6',
        role: 'robot',
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

      const opJoin = waitForMessage(operator);
      operator.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-7',
        role: 'operator',
      }));
      await opJoin;

      const opNotify = waitForMessage(operator);
      const robJoin = waitForMessage(robot);
      robot.send(JSON.stringify({
        type: 'join',
        session_id: 'test-session-7',
        role: 'robot',
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
});

describe('notifyRevocation', () => {
  let app: FastifyInstance;
  let serverAddress: string;

  beforeEach(async () => {
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

    const joinMsg = new Promise<unknown>((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    ws.send(JSON.stringify({
      type: 'join',
      session_id: 'revoke-test-session',
      role: 'operator',
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
