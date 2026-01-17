import type { FastifyInstance } from 'fastify';
import type { JWKS, JWK } from '../types.js';

// Static development Ed25519 key for POC
// WARNING: This is a PUBLIC key only - do not use in production
// Real implementation will load keys from secure storage (M3-006)
//
// This is a well-known test key for development purposes.
// The private key counterpart should NEVER be committed to source control.
const DEV_PUBLIC_KEY: JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  // This is a deterministic test public key (32 bytes, base64url encoded)
  // Generated from a test private key for development only
  x: 'o5Uq1iJNqJ6pVvKwrI5TQHtT5rF_0mKE6t6J9dQj_qQ',
  kid: 'dev-key-1',
  use: 'sig',
  alg: 'EdDSA',
};

// Previous key for rotation overlap (simulates key rotation scenario)
const DEV_PREVIOUS_KEY: JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
  kid: 'dev-key-0',
  use: 'sig',
  alg: 'EdDSA',
};

const jwks: JWKS = {
  keys: [DEV_PUBLIC_KEY, DEV_PREVIOUS_KEY],
};

export async function jwksRoutes(app: FastifyInstance): Promise<void> {
  // /.well-known/jwks.json - Public keys for token verification
  app.get('/.well-known/jwks.json', async () => {
    return jwks;
  });

  // Convenience alias
  app.get('/v1/jwks', async () => {
    return jwks;
  });
}

// Export for testing
export function getJWKS(): JWKS {
  return jwks;
}

export function getCurrentKeyId(): string {
  return DEV_PUBLIC_KEY.kid;
}
