import { describe, it, expect } from 'vitest';
import * as jose from 'jose';
import { createDevKeyManager } from '../key-manager.js';

describe('createDevKeyManager', () => {
  it('should create a key manager', async () => {
    const manager = await createDevKeyManager();

    expect(manager).toBeDefined();
    expect(manager.getSigningKey).toBeInstanceOf(Function);
    expect(manager.getKeyId).toBeInstanceOf(Function);
    expect(manager.getPublicJwk).toBeInstanceOf(Function);
  });

  describe('key pair generation', () => {
    it('should generate a valid Ed25519 key pair', async () => {
      const manager = await createDevKeyManager();
      const signingKey = manager.getSigningKey();

      // Verify we can sign with the key
      const jwt = await new jose.SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'EdDSA' })
        .sign(signingKey);

      expect(jwt).toBeDefined();
      expect(jwt.split('.')).toHaveLength(3);
    });

    it('should produce consistent key ID', async () => {
      const manager = await createDevKeyManager();

      const keyId1 = manager.getKeyId();
      const keyId2 = manager.getKeyId();

      expect(keyId1).toBe(keyId2);
      expect(keyId1).toBe('dev-key-1');
    });
  });

  describe('public JWK structure', () => {
    it('should return valid JWK structure', async () => {
      const manager = await createDevKeyManager();
      const jwk = manager.getPublicJwk();

      expect(jwk.kty).toBe('OKP');
      expect(jwk.crv).toBe('Ed25519');
      expect(jwk.x).toBeDefined();
      expect(typeof jwk.x).toBe('string');
    });

    it('should include required metadata in JWK', async () => {
      const manager = await createDevKeyManager();
      const jwk = manager.getPublicJwk();

      expect(jwk.kid).toBe('dev-key-1');
      expect(jwk.use).toBe('sig');
      expect(jwk.alg).toBe('EdDSA');
    });

    it('should not include private key material', async () => {
      const manager = await createDevKeyManager();
      const jwk = manager.getPublicJwk();

      expect(jwk).not.toHaveProperty('d');
    });

    it('should match key ID between signing key and JWK', async () => {
      const manager = await createDevKeyManager();

      const keyId = manager.getKeyId();
      const jwk = manager.getPublicJwk();

      expect(jwk.kid).toBe(keyId);
    });
  });

  describe('signature verification', () => {
    it('should verify tokens signed with the private key', async () => {
      const manager = await createDevKeyManager();
      const signingKey = manager.getSigningKey();
      const jwk = manager.getPublicJwk();

      const jwt = await new jose.SignJWT({ test: 'data' })
        .setProtectedHeader({ alg: 'EdDSA', kid: manager.getKeyId() })
        .sign(signingKey);

      const publicKey = await jose.importJWK(jwk, 'EdDSA');
      const { payload } = await jose.jwtVerify(jwt, publicKey);

      expect(payload.test).toBe('data');
    });
  });
});
