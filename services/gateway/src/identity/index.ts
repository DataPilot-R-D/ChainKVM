/**
 * Identity module public API.
 * Provides did:key resolution for Ed25519 public keys.
 */

export type {
  DIDDocument,
  DIDResolutionResult,
  DIDResolutionMetadata,
  DIDDocumentMetadata,
  ParsedDIDKey,
  VerificationMethod,
  CacheConfig,
} from './types.js';

export { DIDResolutionError, DIDResolutionErrorCode } from './errors.js';

export {
  parseDIDKey,
  resolveDIDKey,
  createDIDKeyResolver,
  type DIDKeyResolver,
} from './did-key-resolver.js';
