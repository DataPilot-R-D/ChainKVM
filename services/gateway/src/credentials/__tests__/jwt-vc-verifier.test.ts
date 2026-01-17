import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import { createJwtVcVerifier, type JwtVcVerifier } from '../jwt-vc-verifier.js';
import { VCVerificationError, VCVerificationErrorCode } from '../errors.js';
import type { DIDKeyResolver } from '../../identity/index.js';
import {
  TEST_ISSUER_DID,
  UNTRUSTED_ISSUER_DID,
  initTestKeys,
  createMockResolver,
  createTestJwtVc,
  testPublicKeyMultibase,
} from './jwt-vc-verifier-helpers.js';

let publicKeyMultibase: string;

beforeAll(async () => {
  await initTestKeys();
  // Access after initialization
  const helpers = await import('./jwt-vc-verifier-helpers.js');
  publicKeyMultibase = helpers.testPublicKeyMultibase;
});

describe('createJwtVcVerifier', () => {
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

  describe('successful verification', () => {
    it('should verify a valid JWT-VC from trusted issuer', async () => {
      vi.useRealTimers();
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
      const exp = Math.floor(Date.now() / 1000) + 7200;
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
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      const jwtVc = await createTestJwtVc({ exp: pastTime });
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      await expect(verifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.CREDENTIAL_EXPIRED,
      });
    });

    it('should allow VC within clock skew window', async () => {
      vi.useRealTimers();
      const exp = Math.floor(Date.now() / 1000) - 30;
      const jwtVc = await createTestJwtVc({ exp });
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const result = await verifier.verify(jwtVc);
      expect(result.valid).toBe(true);
    });
  });

  describe('not-yet-valid credentials', () => {
    it('should reject VC that is not yet valid', async () => {
      vi.useRealTimers();
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const jwtVc = await createTestJwtVc({ nbf: futureTime });
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      await expect(verifier.verify(jwtVc)).rejects.toThrow(VCVerificationError);
      await expect(verifier.verify(jwtVc)).rejects.toMatchObject({
        code: VCVerificationErrorCode.CREDENTIAL_NOT_YET_VALID,
      });
    });
  });
});
