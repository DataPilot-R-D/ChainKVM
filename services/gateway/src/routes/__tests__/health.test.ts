import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { healthRoutes } from '../health.js';

describe('healthRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 OK with status and timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('GET /v1/health', () => {
    it('should return 200 OK with status and timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /v1/ready', () => {
    it('should return 200 OK with readiness checks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ready).toBe(true);
      expect(body.checks).toBeDefined();
      expect(body.checks.fabric).toBe('stub');
      expect(body.checks.turn).toBe('stub');
    });
  });
});
