import { describe, it, expect, beforeAll } from 'vitest';
import * as jose from 'jose';
import { createTokenGenerator, type TokenGenerator } from '../token-generator.js';
import type { TokenGenerationInput, CapabilityTokenClaims } from '../types.js';

type SigningKey = jose.CryptoKey | jose.KeyObject;

describe('createTokenGenerator', () => {
  let privateKey: SigningKey;
  let publicKey: SigningKey;
  let generator: TokenGenerator;
  const keyId = 'test-key-1';

  beforeAll(async () => {
    const keyPair = await jose.generateKeyPair('EdDSA', { crv: 'Ed25519' });
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
    generator = await createTokenGenerator(privateKey, keyId);
  });

  const validInput: TokenGenerationInput = {
    operatorDid: 'did:key:z6MkoperatorDID',
    robotId: 'robot-001',
    sessionId: 'ses_abc123',
    allowedActions: ['teleop:view', 'teleop:control'],
    ttlSeconds: 3600,
  };

  describe('token structure', () => {
    it('should generate a valid JWT with correct structure', async () => {
      const result = await generator.generate(validInput);

      expect(result.token).toBeDefined();
      expect(result.token.split('.')).toHaveLength(3);
    });

    it('should include correct protected header', async () => {
      const result = await generator.generate(validInput);
      const header = jose.decodeProtectedHeader(result.token);

      expect(header.alg).toBe('EdDSA');
      expect(header.typ).toBe('JWT');
      expect(header.kid).toBe(keyId);
    });
  });

  describe('token claims', () => {
    it('should contain all required claims', async () => {
      const result = await generator.generate(validInput);
      const payload = jose.decodeJwt(result.token) as CapabilityTokenClaims;

      expect(payload.sub).toBe(validInput.operatorDid);
      expect(payload.aud).toBe(validInput.robotId);
      expect(payload.sid).toBe(validInput.sessionId);
      expect(payload.scope).toEqual(validInput.allowedActions);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.jti).toBeDefined();
      expect(payload.nonce).toBeDefined();
    });

    it('should calculate expiry correctly from TTL', async () => {
      const beforeGenerate = Math.floor(Date.now() / 1000);
      const result = await generator.generate(validInput);
      const afterGenerate = Math.floor(Date.now() / 1000);

      const payload = jose.decodeJwt(result.token) as CapabilityTokenClaims;
      const expectedExpMin = beforeGenerate + validInput.ttlSeconds;
      const expectedExpMax = afterGenerate + validInput.ttlSeconds;

      expect(payload.exp).toBeGreaterThanOrEqual(expectedExpMin);
      expect(payload.exp).toBeLessThanOrEqual(expectedExpMax);
    });

    it('should set iat to current time', async () => {
      const beforeGenerate = Math.floor(Date.now() / 1000);
      const result = await generator.generate(validInput);
      const afterGenerate = Math.floor(Date.now() / 1000);

      const payload = jose.decodeJwt(result.token) as CapabilityTokenClaims;

      expect(payload.iat).toBeGreaterThanOrEqual(beforeGenerate);
      expect(payload.iat).toBeLessThanOrEqual(afterGenerate);
    });
  });

  describe('token ID uniqueness', () => {
    it('should generate unique token IDs', async () => {
      const results = await Promise.all([
        generator.generate(validInput),
        generator.generate(validInput),
        generator.generate(validInput),
      ]);

      const tokenIds = results.map(r => r.tokenId);
      const uniqueIds = new Set(tokenIds);

      expect(uniqueIds.size).toBe(tokenIds.length);
    });

    it('should prefix token IDs with tok_', async () => {
      const result = await generator.generate(validInput);

      expect(result.tokenId).toMatch(/^tok_/);
    });

    it('should match tokenId in result with jti claim', async () => {
      const result = await generator.generate(validInput);
      const payload = jose.decodeJwt(result.token) as CapabilityTokenClaims;

      expect(payload.jti).toBe(result.tokenId);
    });
  });

  describe('nonce generation', () => {
    it('should generate unique nonces', async () => {
      const results = await Promise.all([
        generator.generate(validInput),
        generator.generate(validInput),
        generator.generate(validInput),
      ]);

      const nonces = results.map(r => {
        const payload = jose.decodeJwt(r.token) as CapabilityTokenClaims;
        return payload.nonce;
      });
      const uniqueNonces = new Set(nonces);

      expect(uniqueNonces.size).toBe(nonces.length);
    });
  });

  describe('signature verification', () => {
    it('should produce signature verifiable with public key', async () => {
      const result = await generator.generate(validInput);

      const { payload } = await jose.jwtVerify(result.token, publicKey);

      expect(payload.sub).toBe(validInput.operatorDid);
      expect(payload.aud).toBe(validInput.robotId);
    });

    it('should fail verification with wrong key', async () => {
      const result = await generator.generate(validInput);
      const wrongKeyPair = await jose.generateKeyPair('EdDSA', { crv: 'Ed25519' });

      await expect(
        jose.jwtVerify(result.token, wrongKeyPair.publicKey)
      ).rejects.toThrow();
    });
  });

  describe('result properties', () => {
    it('should return correct expiresAt date', async () => {
      const result = await generator.generate(validInput);
      const payload = jose.decodeJwt(result.token) as CapabilityTokenClaims;

      expect(result.expiresAt.getTime()).toBe(payload.exp * 1000);
    });
  });

  describe('performance', () => {
    it('should generate 1000 tokens in under 1000ms', async () => {
      const start = performance.now();

      const promises = Array.from({ length: 1000 }, () =>
        generator.generate(validInput)
      );
      await Promise.all(promises);

      const duration = performance.now() - start;
      const avgMs = duration / 1000;

      expect(avgMs).toBeLessThan(1); // Less than 1ms average
    });
  });
});
