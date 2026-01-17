import type { FastifyInstance } from 'fastify';
import type { JWKS, JWK } from '../types.js';
import type { KeyManager } from '../tokens/index.js';

// Module-level state for the active key manager
let activeKeyManager: KeyManager | null = null;

// Fallback static key for backwards compatibility
const FALLBACK_KEY: JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'o5Uq1iJNqJ6pVvKwrI5TQHtT5rF_0mKE6t6J9dQj_qQ',
  kid: 'dev-key-1',
  use: 'sig',
  alg: 'EdDSA',
};

function buildJWKS(): JWKS {
  if (activeKeyManager) {
    return { keys: [activeKeyManager.getPublicJwk() as JWK] };
  }
  return { keys: [FALLBACK_KEY] };
}

/** Set the key manager for JWKS. Call before registering routes. */
export function setKeyManager(keyManager: KeyManager): void {
  activeKeyManager = keyManager;
}

export async function jwksRoutes(app: FastifyInstance): Promise<void> {
  // /.well-known/jwks.json - Public keys for token verification
  app.get('/.well-known/jwks.json', async () => {
    return buildJWKS();
  });

  // Convenience alias
  app.get('/v1/jwks', async () => {
    return buildJWKS();
  });
}

// Export for testing
export function getJWKS(): JWKS {
  return buildJWKS();
}

export function getCurrentKeyId(): string {
  if (activeKeyManager) {
    return activeKeyManager.getKeyId();
  }
  return FALLBACK_KEY.kid;
}
