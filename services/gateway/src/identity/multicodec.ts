/**
 * Multicodec constants for did:key method.
 * @see https://github.com/multiformats/multicodec
 */

/** Multicodec prefix for Ed25519 public keys */
export const ED25519_CODEC = 0xed;

/** Expected byte length for Ed25519 public keys */
export const ED25519_KEY_LENGTH = 32;

/** Multibase prefix for base58btc encoding */
export const BASE58BTC_PREFIX = 'z';

/** DID method identifier */
export const DID_KEY_METHOD = 'key';

/** DID scheme prefix */
export const DID_SCHEME = 'did';

/** Verification method type for Ed25519 keys */
export const ED25519_VERIFICATION_TYPE = 'Ed25519VerificationKey2020';

/** JSON-LD contexts for DID Documents */
export const DID_CONTEXTS = [
  'https://www.w3.org/ns/did/v1',
  'https://w3id.org/security/suites/ed25519-2020/v1',
] as const;
