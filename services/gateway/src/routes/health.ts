import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/v1/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/v1/ready', async () => ({
    ready: true,
    checks: {
      // TODO: Add actual readiness checks
      fabric: 'stub',
      turn: 'stub',
    },
  }));
}
