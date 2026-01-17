/**
 * Key management for capability token signing.
 * For POC: generates ephemeral key pair on startup.
 */
import * as jose from 'jose';

/** Private key type for Ed25519 signing. */
type PrivateKey = jose.CryptoKey | jose.KeyObject;

/** Key manager interface. */
export interface KeyManager {
  /** Get the private key for signing tokens. */
  getSigningKey(): PrivateKey;
  /** Get the key ID for the current signing key. */
  getKeyId(): string;
  /** Get the public key as a JWK for JWKS endpoint. */
  getPublicJwk(): jose.JWK;
}

/**
 * Create a development key manager with an ephemeral Ed25519 key pair.
 * For production, keys should be loaded from secure storage.
 */
export async function createDevKeyManager(): Promise<KeyManager> {
  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', {
    crv: 'Ed25519',
  });
  const keyId = 'dev-key-1';
  const publicJwk = await jose.exportJWK(publicKey);

  return {
    getSigningKey: () => privateKey,
    getKeyId: () => keyId,
    getPublicJwk: () => ({
      ...publicJwk,
      kid: keyId,
      use: 'sig',
      alg: 'EdDSA',
    }),
  };
}
