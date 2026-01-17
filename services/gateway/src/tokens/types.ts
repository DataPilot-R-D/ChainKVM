/**
 * Capability token types for session authorization.
 * Tokens are JWT-based and signed with Ed25519 (EdDSA).
 */
import type * as jose from 'jose';

/** Ed25519 signing key type (compatible with jose library). */
export type SigningKey = jose.CryptoKey | jose.KeyObject;

/** Claims contained in a capability token JWT. */
export interface CapabilityTokenClaims {
  /** Operator DID (subject). */
  sub: string;
  /** Robot ID (audience). */
  aud: string;
  /** Session ID. */
  sid: string;
  /** Allowed actions/scopes. */
  scope: string[];
  /** Expiry timestamp (Unix seconds). */
  exp: number;
  /** Issued-at timestamp (Unix seconds). */
  iat: number;
  /** Unique token ID. */
  jti: string;
  /** Random nonce for replay protection. */
  nonce: string;
}

/** Input for token generation. */
export interface TokenGenerationInput {
  /** Operator DID. */
  operatorDid: string;
  /** Target robot ID. */
  robotId: string;
  /** Session ID. */
  sessionId: string;
  /** Allowed actions for this session. */
  allowedActions: string[];
  /** Token time-to-live in seconds. */
  ttlSeconds: number;
}

/** Result from token generation. */
export interface TokenGenerationResult {
  /** Signed JWT token. */
  token: string;
  /** When the token expires. */
  expiresAt: Date;
  /** Unique token ID (jti). */
  tokenId: string;
}
