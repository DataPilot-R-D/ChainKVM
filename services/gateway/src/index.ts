import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { loadConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { revocationRoutes } from './routes/revocations.js';
import { auditRoutes } from './routes/audit.js';
import { jwksRoutes } from './routes/jwks.js';
import { signalingRoutes } from './routes/signaling.js';

async function main() {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Register WebSocket support
  await app.register(websocket);

  // Register routes
  await app.register(healthRoutes);
  await app.register(async (instance) => sessionRoutes(instance, config));
  await app.register(revocationRoutes);
  await app.register(auditRoutes);
  await app.register(jwksRoutes);
  await app.register(signalingRoutes);

  // Startup
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port }, 'Gateway started');
}

main().catch((err) => {
  console.error('Gateway failed to start:', err);
  process.exit(1);
});
