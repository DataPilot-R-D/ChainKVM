/**
 * Capability token generation module.
 */
export type {
  CapabilityTokenClaims,
  SigningKey,
  TokenGenerationInput,
  TokenGenerationResult,
} from './types.js';
export { createTokenGenerator, type TokenGenerator } from './token-generator.js';
export { createDevKeyManager, type KeyManager } from './key-manager.js';
