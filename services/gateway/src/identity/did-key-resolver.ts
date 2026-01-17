/**
 * did:key method resolver for Ed25519 public keys.
 */

import { base58btc } from 'multiformats/bases/base58';
import { varint } from 'multiformats';
import type { ParsedDIDKey, DIDResolutionResult, CacheConfig } from './types.js';
import { DIDResolutionError } from './errors.js';
import {
  ED25519_CODEC,
  ED25519_KEY_LENGTH,
  BASE58BTC_PREFIX,
  DID_KEY_METHOD,
  DID_SCHEME,
} from './multicodec.js';
import { buildDIDDocument } from './did-document.js';
import { createCache, type Cache } from './cache.js';

interface DIDParts {
  scheme: string;
  method: string;
  identifier: string;
}

/** Validate DID structure and extract components. */
function validateDIDStructure(did: string): DIDParts {
  if (!did || typeof did !== 'string') {
    throw DIDResolutionError.invalidDid(did, 'DID must be a non-empty string');
  }

  const parts = did.split(':');
  if (parts.length < 3) {
    throw DIDResolutionError.invalidDid(did, 'DID must have format did:method:identifier');
  }

  const [scheme, method, ...rest] = parts;
  const identifier = rest.join(':');

  if (scheme !== DID_SCHEME) {
    throw DIDResolutionError.invalidDid(did, `Must start with '${DID_SCHEME}:'`);
  }
  if (!method) throw DIDResolutionError.invalidDid(did, 'Missing method');
  if (method !== DID_KEY_METHOD) throw DIDResolutionError.unsupportedMethod(did, method);
  if (!identifier) throw DIDResolutionError.invalidDid(did, 'Missing identifier');

  return { scheme, method, identifier };
}

/** Decode multibase identifier and extract public key bytes. */
function decodeMultibaseKey(did: string, identifier: string): { codecPrefix: number; publicKey: Uint8Array } {
  if (!identifier.startsWith(BASE58BTC_PREFIX)) {
    throw DIDResolutionError.invalidMultibase(did, `Must start with '${BASE58BTC_PREFIX}'`);
  }

  let decoded: Uint8Array;
  try {
    decoded = base58btc.decode(identifier);
  } catch {
    throw DIDResolutionError.invalidMultibase(did, 'Invalid base58btc encoding');
  }

  if (decoded.length < 2) {
    throw DIDResolutionError.invalidDid(did, 'Decoded key data too short');
  }

  const [codecPrefix, bytesRead] = varint.decode(decoded);
  if (codecPrefix !== ED25519_CODEC) {
    throw DIDResolutionError.unsupportedKeyType(did, codecPrefix);
  }

  const publicKey = decoded.slice(bytesRead);
  if (publicKey.length !== ED25519_KEY_LENGTH) {
    throw DIDResolutionError.invalidPublicKey(did, ED25519_KEY_LENGTH, publicKey.length);
  }

  return { codecPrefix, publicKey };
}

/** Build error resolution result. */
function buildErrorResult(error: unknown, duration: number): DIDResolutionResult {
  const errorCode = error instanceof DIDResolutionError ? error.code : 'internalError';
  return {
    didResolutionMetadata: { error: errorCode, duration },
    didDocument: null,
    didDocumentMetadata: {},
  };
}

/**
 * Parse a did:key identifier into its components.
 * @throws {DIDResolutionError} If the DID is invalid or uses unsupported method/key type
 */
export function parseDIDKey(did: string): ParsedDIDKey {
  const { identifier } = validateDIDStructure(did);
  const { codecPrefix, publicKey } = decodeMultibaseKey(did, identifier);
  return { did, method: 'key', identifier, codecPrefix, publicKey };
}

/**
 * Resolve a did:key identifier to a DID Document.
 * Returns a DIDResolutionResult with error metadata if resolution fails.
 */
export function resolveDIDKey(did: string): DIDResolutionResult {
  const start = performance.now();

  try {
    const parsed = parseDIDKey(did);
    const didDocument = buildDIDDocument(parsed);
    const duration = performance.now() - start;

    return {
      didResolutionMetadata: { contentType: 'application/did+ld+json', duration },
      didDocument,
      didDocumentMetadata: {},
    };
  } catch (error) {
    return buildErrorResult(error, performance.now() - start);
  }
}

/** DID Key Resolver interface with caching */
export interface DIDKeyResolver {
  parse(did: string): ParsedDIDKey;
  resolve(did: string): DIDResolutionResult;
  clearCache(): void;
}

/** Create a cached DID Key resolver. */
export function createDIDKeyResolver(cacheConfig: CacheConfig): DIDKeyResolver {
  const cache: Cache<DIDResolutionResult> = createCache(cacheConfig);

  return {
    parse: parseDIDKey,

    resolve(did: string): DIDResolutionResult {
      const cached = cache.get(did);
      if (cached) {
        return { ...cached, didResolutionMetadata: { ...cached.didResolutionMetadata, cached: true } };
      }

      const result = resolveDIDKey(did);
      if (result.didDocument) cache.set(did, result);
      return result;
    },

    clearCache: () => cache.clear(),
  };
}
