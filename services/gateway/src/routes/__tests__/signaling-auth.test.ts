import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TestContext,
  createTestServer,
  createTestToken,
  createClient,
  waitForOpen,
  waitForMessage,
} from './signaling-test-utils.js';

describe('signaling authentication', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('should reject join without token', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);

    const messagePromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'join', session_id: 'test-session', role: 'operator' }));

    expect(await messagePromise).toEqual({
      type: 'error',
      code: 'missing_token',
      message: 'Token is required',
    });

    ws.close();
  });

  it('should reject join with invalid token format', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);

    const messagePromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'join', session_id: 'test-session', role: 'operator', token: 'not-a-jwt' }));

    expect(await messagePromise).toEqual({
      type: 'error',
      code: 'invalid_token',
      message: 'Invalid token format',
    });

    ws.close();
  });

  it('should reject join when token session does not match', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);

    const messagePromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'join',
      session_id: 'test-session-A',
      role: 'operator',
      token: createTestToken('test-session-B'),
    }));

    expect(await messagePromise).toEqual({
      type: 'error',
      code: 'session_mismatch',
      message: 'Token session does not match',
    });

    ws.close();
  });

  it('should reject join when token is not registered', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);

    const messagePromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'join',
      session_id: 'test-session-unregistered',
      role: 'operator',
      token: createTestToken('test-session-unregistered', 'tok_unregistered'),
    }));

    expect(await messagePromise).toEqual({
      type: 'error',
      code: 'token_invalid',
      message: 'Token is not valid or expired',
    });

    ws.close();
  });

  it('should reject join when token is expired', async () => {
    const ws = createClient(ctx.serverAddress);
    await waitForOpen(ws);

    ctx.registry.register({
      jti: 'tok_expired',
      sessionId: 'test-session-expired',
      operatorDid: 'did:key:test',
      robotId: 'robot-1',
      expiresAt: new Date(Date.now() - 1000),
    });

    const messagePromise = waitForMessage(ws);
    ws.send(JSON.stringify({
      type: 'join',
      session_id: 'test-session-expired',
      role: 'operator',
      token: createTestToken('test-session-expired', 'tok_expired'),
    }));

    expect(await messagePromise).toEqual({
      type: 'error',
      code: 'token_invalid',
      message: 'Token is not valid or expired',
    });

    ws.close();
  });
});
