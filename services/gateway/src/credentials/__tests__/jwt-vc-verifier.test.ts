import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import * as jose from 'jose';
import { base58btc } from 'multiformats/bases/base58';
import { createJwtVcVerifier, type JwtVcVerifier } from '../jwt-vc-verifier.js';
import { VCVerificationError, VCVerificationErrorCode } from '../errors.js';
import type { DIDKeyResolver } from '../../identity/index.js';
import type { DIDDocument, DIDResolutionResult } from '../../identity/types.js';

// Test fixtures
const TEST_ISSUER_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
const UNTRUSTED_ISSUER_DID = 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH';

let testKeyPair: Awaited<ReturnType<typeof jose.generateKeyPair>>;
let testPublicKeyMultibase: string;

// Helper to create a mock DID resolver
function createMockResolver(publicKeyMultibase: string): DIDKeyResolver {
  const didDocument: DIDDocument = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: TEST_ISSUER_DID,
    verificationMethod: [{
      id: `${TEST_ISSUER_DID}#key-1`,
      type: 'Ed25519VerificationKey2020',
      controller: TEST_ISSUER_DID,
      publicKeyMultibase,
    }],
    authentication: [`${TEST_ISSUER_DID}#key-1`],
    assertionMethod: [`${TEST_ISSUER_DID}#key-1`],
  };

  const result: DIDResolutionResult = {
    didResolutionMetadata: { contentType: 'application/did+ld+json' },
    didDocument,
    didDocumentMetadata: {},
  };

  return {
    parse: vi.fn(),
    resolve: vi.fn().mockReturnValue(result),
    clearCache: vi.fn(),
  };
}

// Helper to create a valid JWT-VC
async function createTestJwtVc(options: {
  issuer?: string;
  subject?: string;
  exp?: number;
  nbf?: number;
  vc?: object;
} = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: options.issuer ?? TEST_ISSUER_DID,
    sub: options.subject ?? 'did:key:z6MksubjectDID',
    iat: now,
    exp: options.exp ?? now + 3600, // 1 hour from now
    nbf: options.nbf,
    vc: options.vc ?? {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'OperatorCredential'],
      issuer: options.issuer ?? TEST_ISSUER_DID,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: options.subject ?? 'did:key:z6MksubjectDID',
        role: 'operator',
      },
    },
  };

  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(testKeyPair.privateKey);
}

// Convert JWK to multibase format for DID document
async function jwkToMultibase(publicKey: Awaited<ReturnType<typeof jose.importJWK>>): Promise<string> {
  const jwk = await jose.exportJWK(publicKey);
  const rawKey = jose.base64url.decode(jwk.x!);
  // Ed25519 multicodec prefix: 0xed with varint encoding = [0xed, 0x01]
  const prefixed = new Uint8Array([0xed, 0x01, ...rawKey]);
  return base58btc.encode(prefixed);
}

beforeAll(async () => {
  // Generate Ed25519 key pair for testing
  testKeyPair = await jose.generateKeyPair('EdDSA', { crv: 'Ed25519' });
  testPublicKeyMultibase = await jwkToMultibase(testKeyPair.publicKey);
});

describe('createJwtVcVerifier', () => {
  let verifier: JwtVcVerifier;
  let mockResolver: DIDKeyResolver;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    mockResolver = createMockResolver(testPublicKeyMultibase);
    verifier = createJwtVcVerifier({
      trustedIssuers: [TEST_ISSUER_DID],
      didResolver: mockResolver,
      clockSkewMs: 60_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful verification', () => {
    it('should verify a valid JWT-VC from trusted issuer', async () => {
      vi.useRealTimers(); // Need real time for JWT creation
      const jwtVc = await createTestJwtVc();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const result = await verifier.verify(jwtVc);

      expect(result.valid).toBe(true);
      expect(result.issuer).toBe(TEST_ISSUER_DID);
      expect(result.credential).toBeDefined();
      expect(result.credential.type).toContain('VerifiableCredential');
    });

    it('should include expiration date in result', async () => {
      vi.useRealTimers();
      const exp = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const jwtVc = await createTestJwtVc({ exp });
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const result = await verifier.verify(jwtVc);

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt?.getTime()).toBe(exp * 1000);
    });

    it('should include subject in result when present', async () => {
      vi.useRealTimers();
      const subject = 'did:key:z6MksubjectTest';
      const jwtVc = await createTestJwtVc({ subject });
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const result = await verifier.verify(jwtVc);

      expect(result.subject).toBe(subject);
    });
  });

  describe('untrusted issuer', () => {
    it('should reject VC from untrusted issuer', async () => {
      vi.useRealTimers();
      const jwtVc = await createTestJwtVc({ issuer: UNTRUSTED_ISSUER_DID });
      vi.useFakeTimers();

      await expect(verifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.UNTRUSTED_ISSUER,
      });
    });
  });

  describe('expired credentials', () => {
    it('should reject expired VC', async () => {
      vi.useRealTimers();
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const jwtVc = await createTestJwtVc({ exp: pastTime });
      vi.useFakeTimers();
      vi.setSystemTime(new Date()); // Use current time

      await expect(verifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.CREDENTIAL_EXPIRED,
      });
    });

    it('should allow VC within clock skew window', async () => {
      vi.useRealTimers();
      // Expired 30 seconds ago (within 60s clock skew)
      const exp = Math.floor(Date.now() / 1000) - 30;
      const jwtVc = await createTestJwtVc({ exp });
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      // Should not throw because it's within clock skew
      const result = await verifier.verify(jwtVc);
      expect(result.valid).toBe(true);
    });
  });

  describe('not-yet-valid credentials', () => {
    it('should reject VC that is not yet valid', async () => {
      vi.useRealTimers();
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const jwtVc = await createTestJwtVc({ nbf: futureTime });
      vi.useFakeTimers();
      vi.setSystemTime(new Date()); // Use current time

      await expect(verifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.CREDENTIAL_NOT_YET_VALID,
      });
    });
  });

  describe('invalid JWT', () => {
    it('should reject malformed JWT', async () => {
      const invalidJwt = 'not.a.valid.jwt';

      await expect(verifier.verify(invalidJwt)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(invalidJwt)).rejects.toMatchObject({
        code: VCVerificationErrorCode.INVALID_JWT,
      });
    });

    it('should reject JWT missing vc claim', async () => {
      vi.useRealTimers();
      const now = Math.floor(Date.now() / 1000);
      const jwtWithoutVc = await new jose.SignJWT({
        iss: TEST_ISSUER_DID,
        sub: 'did:key:z6MksubjectDID',
        iat: now,
        exp: now + 3600,
        // No vc claim
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .sign(testKeyPair.privateKey);
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      await expect(verifier.verify(jwtWithoutVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtWithoutVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.MISSING_VC_CLAIM,
      });
    });
  });

  describe('invalid signature', () => {
    it('should reject VC with tampered payload', async () => {
      vi.useRealTimers();
      const jwtVc = await createTestJwtVc();

      // Tamper with the payload (middle part of JWT)
      const [header, , signature] = jwtVc.split('.');
      const tamperedPayload = jose.base64url.encode(
        JSON.stringify({ iss: TEST_ISSUER_DID, tampered: true })
      );
      const tamperedJwt = `${header}.${tamperedPayload}.${signature}`;
      vi.useFakeTimers();

      await expect(verifier.verify(tamperedJwt)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(tamperedJwt)).rejects.toMatchObject({
        code: VCVerificationErrorCode.INVALID_SIGNATURE,
      });
    });
  });

  describe('issuer resolution failure', () => {
    it('should handle DID resolution failure', async () => {
      vi.useRealTimers();
      const jwtVc = await createTestJwtVc();

      // Mock resolver to return error
      const failingResolver: DIDKeyResolver = {
        parse: vi.fn(),
        resolve: vi.fn().mockReturnValue({
          didResolutionMetadata: { error: 'notFound' },
          didDocument: null,
          didDocumentMetadata: {},
        }),
        clearCache: vi.fn(),
      };

      const failingVerifier = createJwtVcVerifier({
        trustedIssuers: [TEST_ISSUER_DID],
        didResolver: failingResolver,
      });
      vi.useFakeTimers();

      await expect(failingVerifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(failingVerifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.ISSUER_RESOLUTION_FAILED,
      });
    });
  });

  describe('unsupported algorithm', () => {
    it('should reject JWT with unsupported algorithm', async () => {
      vi.useRealTimers();
      // Create a JWT with HS256 (HMAC, not supported for VCs)
      const secret = new TextEncoder().encode('super-secret-key-for-testing-only');
      const now = Math.floor(Date.now() / 1000);
      const jwtVc = await new jose.SignJWT({
        iss: TEST_ISSUER_DID,
        sub: 'did:key:z6MksubjectDID',
        iat: now,
        exp: now + 3600,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential'],
          issuer: TEST_ISSUER_DID,
          issuanceDate: new Date().toISOString(),
          credentialSubject: { id: 'did:key:z6MksubjectDID' },
        },
      })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(secret);
      vi.useFakeTimers();

      await expect(verifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.UNSUPPORTED_ALGORITHM,
      });
    });
  });
});
