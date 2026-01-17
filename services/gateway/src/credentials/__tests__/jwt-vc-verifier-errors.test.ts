import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import * as jose from 'jose';
import { createJwtVcVerifier, type JwtVcVerifier } from '../jwt-vc-verifier.js';
import { VCVerificationError, VCVerificationErrorCode } from '../errors.js';
import type { DIDKeyResolver } from '../../identity/index.js';
import {
  TEST_ISSUER_DID,
  initTestKeys,
  createMockResolver,
  createTestJwtVc,
} from './jwt-vc-verifier-helpers.js';

let publicKeyMultibase: string;
let testKeyPair: Awaited<ReturnType<typeof jose.generateKeyPair>>;

beforeAll(async () => {
  await initTestKeys();
  const helpers = await import('./jwt-vc-verifier-helpers.js');
  publicKeyMultibase = helpers.testPublicKeyMultibase;
  testKeyPair = helpers.testKeyPair;
});

describe('createJwtVcVerifier error handling', () => {
  let verifier: JwtVcVerifier;
  let mockResolver: DIDKeyResolver;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    mockResolver = createMockResolver(publicKeyMultibase);
    verifier = createJwtVcVerifier({
      trustedIssuers: [TEST_ISSUER_DID],
      didResolver: mockResolver,
      clockSkewMs: 60_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
