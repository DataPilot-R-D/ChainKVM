import Fastify, { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import { signalingRoutes, setTokenRegistry } from '../signaling.js';
import { createTokenRegistry, TokenRegistry } from '../../tokens/index.js';

export interface TestContext {
  app: FastifyInstance;
  serverAddress: string;
  registry: TokenRegistry;
}

export function createTestToken(sessionId: string, jti = `tok_${Date.now()}`): string {
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

export async function createTestServer(): Promise<TestContext> {
  const registry = createTokenRegistry();
  setTokenRegistry(registry);

  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);
  await app.register(signalingRoutes);
  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  const serverAddress = typeof address === 'object' && address
    ? `ws://127.0.0.1:${address.port}`
    : '';

  return { app, serverAddress, registry };
}

export function registerToken(registry: TokenRegistry, sessionId: string, jti: string): void {
  registry.register({
    jti,
    sessionId,
    operatorDid: 'did:key:test',
    robotId: 'robot-1',
    expiresAt: new Date(Date.now() + 3600000),
  });
}

export function createClient(serverAddress: string): WebSocket {
  return new WebSocket(`${serverAddress}/v1/signal`);
}

export function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

export function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<unknown> {
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

export interface JoinParams {
  sessionId: string;
  role: 'operator' | 'robot';
  token: string;
}

export async function joinSession(ws: WebSocket, params: JoinParams): Promise<unknown> {
  const messagePromise = waitForMessage(ws);
  ws.send(JSON.stringify({
    type: 'join',
    session_id: params.sessionId,
    role: params.role,
    token: params.token,
  }));
  return messagePromise;
}

export async function setupTwoPeers(
  ctx: TestContext,
  sessionId: string,
): Promise<{ operator: WebSocket; robot: WebSocket; token: string; jti: string }> {
  const jti = `tok_${sessionId}`;
  registerToken(ctx.registry, sessionId, jti);
  const token = createTestToken(sessionId, jti);

  const operator = createClient(ctx.serverAddress);
  const robot = createClient(ctx.serverAddress);
  await Promise.all([waitForOpen(operator), waitForOpen(robot)]);

  await joinSession(operator, { sessionId, role: 'operator', token });

  const opNotify = waitForMessage(operator);
  await joinSession(robot, { sessionId, role: 'robot', token });
  await opNotify;

  return { operator, robot, token, jti };
}
