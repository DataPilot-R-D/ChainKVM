import { describe, it, expect } from 'vitest';
import { parseDIDKey, resolveDIDKey, createDIDKeyResolver } from '../did-key-resolver.js';
import { DIDResolutionError, DIDResolutionErrorCode } from '../errors.js';

// Known test vector from did:key specification
// https://w3c-ccg.github.io/did-method-key/#example-1-a-simple-did-key-value
const TEST_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
// Public key extracted from the did:key (base58btc decoded, multicodec prefix stripped)
const EXPECTED_PUBLIC_KEY_HEX = '2e6fcce36701dc791488e0d0b1745cc1e33a4c1c9fcc41c63bd343dbbe0970e6';

describe('parseDIDKey', () => {
  describe('valid did:key parsing', () => {
    it('should parse a valid Ed25519 did:key', () => {
      const result = parseDIDKey(TEST_DID);

      expect(result.did).toBe(TEST_DID);
      expect(result.method).toBe('key');
      expect(result.identifier).toBe('z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
      expect(result.codecPrefix).toBe(0xed);
      expect(result.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.publicKey.length).toBe(32);
    });

    it('should extract correct public key bytes', () => {
      const result = parseDIDKey(TEST_DID);
      const actualHex = Buffer.from(result.publicKey).toString('hex');

      expect(actualHex).toBe(EXPECTED_PUBLIC_KEY_HEX);
    });
  });

  describe('invalid DID format', () => {
    it('should reject non-DID strings', () => {
      expect(() => parseDIDKey('not-a-did')).toThrow(DIDResolutionError);
      expect(() => parseDIDKey('not-a-did')).toThrow(/Invalid DID format/);
    });

    it('should reject empty string', () => {
      expect(() => parseDIDKey('')).toThrow(DIDResolutionError);
    });

    it('should reject DID without method', () => {
      expect(() => parseDIDKey('did:')).toThrow(DIDResolutionError);
    });

    it('should reject DID without identifier', () => {
      expect(() => parseDIDKey('did:key:')).toThrow(DIDResolutionError);
    });
  });

  describe('unsupported DID methods', () => {
    it('should reject did:web method', () => {
      expect(() => parseDIDKey('did:web:example.com')).toThrow(DIDResolutionError);
    });

    it('should reject did:ethr method', () => {
      expect(() => parseDIDKey('did:ethr:0x123')).toThrow(DIDResolutionError);
    });

    it('should include method name in error message', () => {
      try {
        parseDIDKey('did:web:example.com');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DIDResolutionError);
        expect((e as DIDResolutionError).code).toBe(DIDResolutionErrorCode.UNSUPPORTED_METHOD);
        expect((e as DIDResolutionError).message).toContain('web');
      }
    });
  });

  describe('invalid multibase encoding', () => {
    it('should reject identifier without multibase prefix', () => {
      expect(() => parseDIDKey('did:key:6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'))
        .toThrow(DIDResolutionError);
    });

    it('should reject identifier with wrong multibase prefix', () => {
      // 'f' is base16 prefix, not base58btc
      expect(() => parseDIDKey('did:key:f6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'))
        .toThrow(DIDResolutionError);
    });

    it('should reject invalid base58btc characters', () => {
      // '0', 'O', 'I', 'l' are not valid in base58btc
      expect(() => parseDIDKey('did:key:z0InvalidBase58')).toThrow(DIDResolutionError);
    });
  });

  describe('unsupported key types', () => {
    it('should reject non-Ed25519 key codec', () => {
      // This is a P-256 key (codec 0x1200) - not supported
      // We'll construct a valid multibase but with wrong codec
      expect(() => parseDIDKey('did:key:zDnaerDaTF5BXEavCrfRZEk316dpbLsfPDZ3WJ5hRTPFU2169'))
        .toThrow(DIDResolutionError);
    });
  });

  describe('invalid key length', () => {
    it('should reject public key with wrong length', () => {
      // Construct a did:key with Ed25519 codec but wrong key length
      // This would be caught during parsing if the key bytes are wrong
      expect(() => parseDIDKey('did:key:z6Lk')) // Too short
        .toThrow(DIDResolutionError);
    });
  });
});

describe('resolveDIDKey', () => {
  describe('successful resolution', () => {
    it('should resolve a valid did:key to a DID Document', () => {
      const result = resolveDIDKey(TEST_DID);

      expect(result.didDocument).not.toBeNull();
      expect(result.didResolutionMetadata.error).toBeUndefined();
    });

    it('should include correct DID in document', () => {
      const result = resolveDIDKey(TEST_DID);

      expect(result.didDocument?.id).toBe(TEST_DID);
    });

    it('should include verification method', () => {
      const result = resolveDIDKey(TEST_DID);
      const vm = result.didDocument?.verificationMethod[0];

      expect(vm).toBeDefined();
      expect(vm?.type).toBe('Ed25519VerificationKey2020');
      expect(vm?.controller).toBe(TEST_DID);
      expect(vm?.publicKeyMultibase).toBe('z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
    });

    it('should include authentication relationship', () => {
      const result = resolveDIDKey(TEST_DID);

      expect(result.didDocument?.authentication).toContain(
        `${TEST_DID}#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK`
      );
    });

    it('should include assertionMethod relationship', () => {
      const result = resolveDIDKey(TEST_DID);

      expect(result.didDocument?.assertionMethod).toContain(
        `${TEST_DID}#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK`
      );
    });

    it('should include JSON-LD context', () => {
      const result = resolveDIDKey(TEST_DID);

      expect(result.didDocument?.['@context']).toContain('https://www.w3.org/ns/did/v1');
      expect(result.didDocument?.['@context']).toContain(
        'https://w3id.org/security/suites/ed25519-2020/v1'
      );
    });

    it('should report resolution duration', () => {
      const result = resolveDIDKey(TEST_DID);

      expect(result.didResolutionMetadata.duration).toBeDefined();
      expect(result.didResolutionMetadata.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('failed resolution', () => {
    it('should return error in metadata for invalid DID', () => {
      const result = resolveDIDKey('not-a-did');

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe(DIDResolutionErrorCode.INVALID_DID);
    });

    it('should return error for unsupported method', () => {
      const result = resolveDIDKey('did:web:example.com');

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe(DIDResolutionErrorCode.UNSUPPORTED_METHOD);
    });
  });
});

describe('createDIDKeyResolver', () => {
  describe('caching behavior', () => {
    it('should cache resolved documents', () => {
      const resolver = createDIDKeyResolver({ ttlMs: 60000, maxSize: 100 });

      const first = resolver.resolve(TEST_DID);
      const second = resolver.resolve(TEST_DID);

      expect(first.didResolutionMetadata.cached).toBeFalsy();
      expect(second.didResolutionMetadata.cached).toBe(true);
    });

    it('should resolve faster on cache hit', () => {
      const resolver = createDIDKeyResolver({ ttlMs: 60000, maxSize: 100 });

      resolver.resolve(TEST_DID); // warm cache
      const start = performance.now();
      resolver.resolve(TEST_DID);
      const duration = performance.now() - start;

      // Cached resolution should be under 1ms
      expect(duration).toBeLessThan(1);
    });
  });

  describe('performance', () => {
    it('should resolve in under 10ms (uncached)', () => {
      const resolver = createDIDKeyResolver({ ttlMs: 60000, maxSize: 100 });

      const result = resolver.resolve(TEST_DID);

      expect(result.didResolutionMetadata.duration).toBeLessThan(10);
    });
  });

  describe('parse method', () => {
    it('should expose parse method', () => {
      const resolver = createDIDKeyResolver({ ttlMs: 60000, maxSize: 100 });

      const parsed = resolver.parse(TEST_DID);

      expect(parsed.method).toBe('key');
      expect(parsed.publicKey.length).toBe(32);
    });
  });

  describe('clearCache', () => {
    it('should clear cache and force re-resolution', () => {
      const resolver = createDIDKeyResolver({ ttlMs: 60000, maxSize: 100 });

      resolver.resolve(TEST_DID);
      resolver.clearCache();
      const result = resolver.resolve(TEST_DID);

      expect(result.didResolutionMetadata.cached).toBeFalsy();
    });
  });

  describe('error caching', () => {
    it('should not cache failed resolutions', () => {
      const resolver = createDIDKeyResolver({ ttlMs: 60000, maxSize: 100 });

      resolver.resolve('invalid-did');
      const second = resolver.resolve('invalid-did');

      expect(second.didResolutionMetadata.cached).toBeFalsy();
    });
  });
});
