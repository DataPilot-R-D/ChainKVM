import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { loadConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import {
  sessionRoutes,
  setTokenGenerator,
  setTokenRegistry,
  setPolicyEvaluator,
  setPolicyStore,
} from './routes/sessions.js';
import { createPolicyStore, createPolicyEvaluator, type PolicyRule } from './policy/index.js';
import { revocationRoutes } from './routes/revocations.js';
import { auditRoutes } from './routes/audit.js';
import { jwksRoutes, setKeyManager } from './routes/jwks.js';
import { signalingRoutes } from './routes/signaling.js';
import {
  createDevKeyManager,
  createTokenGenerator,
  createTokenRegistry,
  createExpiryMonitor,
} from './tokens/index.js';

// Default expiry warning threshold (60 seconds before expiry)
const EXPIRY_WARNING_THRESHOLD_MS = 60_000;
// Default expiry check interval (10 seconds)
const EXPIRY_CHECK_INTERVAL_MS = 10_000;
// Default cleanup interval (30 seconds)
const CLEANUP_INTERVAL_MS = 30_000;

async function main() {
  const config = loadConfig();

  // Initialize key management and token generation
  const keyManager = await createDevKeyManager();
  const tokenGenerator = await createTokenGenerator(
    keyManager.getSigningKey(),
    keyManager.getKeyId()
  );

  // Initialize token registry and expiry monitor
  const tokenRegistry = createTokenRegistry();
  const expiryMonitor = createExpiryMonitor();

  // Initialize policy store and evaluator with default policy
  const policyStore = createPolicyStore();
  const policyEvaluator = createPolicyEvaluator();

  // Create default policy allowing operators to use teleoperation
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

  // Configure modules with dependencies
  setKeyManager(keyManager);
  setTokenGenerator(tokenGenerator);
  setTokenRegistry(tokenRegistry);
  setPolicyEvaluator(policyEvaluator);
  setPolicyStore(policyStore);

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
  await app.register(async (instance) => revocationRoutes(instance, config));
  await app.register(auditRoutes);
  await app.register(jwksRoutes);
  await app.register(signalingRoutes);

  // Start token cleanup and expiry monitoring
  tokenRegistry.startCleanup(CLEANUP_INTERVAL_MS);
  expiryMonitor.start(tokenRegistry, (warning) => {
    app.log.warn({
      event: 'TOKEN_EXPIRY_WARNING',
      sessionId: warning.sessionId,
      jti: warning.jti,
      expiresAt: warning.expiresAt.toISOString(),
      remainingMs: warning.remainingMs,
    }, 'Token expiring soon');
  }, {
    warningThresholdMs: EXPIRY_WARNING_THRESHOLD_MS,
    checkIntervalMs: EXPIRY_CHECK_INTERVAL_MS,
  });

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    expiryMonitor.stop();
    tokenRegistry.stopCleanup();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Startup
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ port: config.port }, 'Gateway started');
}

main().catch((err) => {
  console.error('Gateway failed to start:', err);
  process.exit(1);
});
