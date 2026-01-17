import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { revocationRoutes } from '../revocations.js';
import { sessionRoutes, getSession } from '../sessions.js';
import type { Config } from '../../config.js';
import type { CreateRevocationRequest, CreateRevocationResponse, CreateSessionRequest } from '../../types.js';

const testConfig: Config = {
  port: 4000,
  host: '0.0.0.0',
  turnUrl: 'turn:localhost:3478',
  turnSecret: 'test-secret',
  stunUrl: 'stun:stun.l.google.com:19302',
  sessionTtlSeconds: 3600,
  maxControlRateHz: 20,
  maxVideoBitrateKbps: 4000,
};

describe('revocationRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register((fastify) => sessionRoutes(fastify, testConfig));
    await app.register(revocationRoutes);
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
    it('should create a revocation for a session', async () => {
      const sessionId = await createTestSession();

      const request: CreateRevocationRequest = {
        session_id: sessionId,
        reason: 'Policy violation',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/revocations',
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
