/**
 * Capability token generator using Ed25519 (EdDSA) signing.
 */
import * as jose from 'jose';
import type { SigningKey, TokenGenerationInput, TokenGenerationResult } from './types.js';

/** Token generator interface. */
export interface TokenGenerator {
  /** Generate a signed capability token. */
  generate(input: TokenGenerationInput): Promise<TokenGenerationResult>;
}

/**
 * Create a token generator with the given signing key.
 * @param privateKey - Ed25519 private key for signing
 * @param keyId - Key ID to include in JWT header
 */
export async function createTokenGenerator(
  privateKey: SigningKey,
  keyId: string
): Promise<TokenGenerator> {
  return {
    async generate(input: TokenGenerationInput): Promise<TokenGenerationResult> {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + input.ttlSeconds;
      const jti = `tok_${crypto.randomUUID()}`;

      const token = await new jose.SignJWT({
        sub: input.operatorDid,
        aud: input.robotId,
        sid: input.sessionId,
        scope: input.allowedActions,
        nonce: crypto.randomUUID(),
      })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: keyId })
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .setJti(jti)
        .sign(privateKey);

      return {
        token,
        expiresAt: new Date(exp * 1000),
        tokenId: jti,
      };
    },
  };
}
