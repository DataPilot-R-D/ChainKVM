/**
 * Capability token generation and registry module.
 */
export type {
  CapabilityTokenClaims,
  SigningKey,
  TokenGenerationInput,
  TokenGenerationResult,
} from './types.js';
export { createTokenGenerator, type TokenGenerator } from './token-generator.js';
export { createDevKeyManager, type KeyManager } from './key-manager.js';
export { createTokenRegistry, type TokenRegistry, type TokenEntry } from './token-registry.js';
export { createExpiryMonitor, type ExpiryMonitor, type ExpiryWarning } from './expiry-monitor.js';
export {
  createRevocationCache,
  type RevocationCache,
  type RevokedEntry,
  type RevocationCacheConfig,
} from './revocation-cache.js';
export { createRevocationStore, type RevocationStore } from './revocation-store.js';
export { createCacheMetrics, type CacheMetrics, type CacheMetricsSnapshot } from './cache-metrics.js';
