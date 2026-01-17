/**
 * Verifiable Credential types based on W3C VC Data Model.
 * @see https://www.w3.org/TR/vc-data-model/
 */

/**
 * W3C Verifiable Credential structure.
 */
export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string | { id: string };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: CredentialSubject;
}

/**
 * Credential subject containing claims about the subject.
 */
export interface CredentialSubject {
  id?: string;
  [key: string]: unknown;
}

/**
 * JWT-VC payload structure.
 * @see https://www.w3.org/TR/vc-data-model/#jwt-encoding
 */
export interface JwtVcPayload {
  /** Issuer DID */
  iss: string;
  /** Subject DID */
  sub?: string;
  /** JWT ID */
  jti?: string;
  /** Verifiable Credential */
  vc: VerifiableCredential;
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Issued at (Unix timestamp) */
  iat?: number;
  /** Not before (Unix timestamp) */
  nbf?: number;
}

/**
 * Supported JWT algorithms for VC signing.
 */
export type SupportedAlgorithm = 'EdDSA' | 'ES256';

/**
 * Result of VC verification.
 */
export interface VCVerificationResult {
  /** Whether verification succeeded */
  valid: boolean;
  /** The verified credential */
  credential: VerifiableCredential;
  /** Issuer DID */
  issuer: string;
  /** Subject DID (if present) */
  subject?: string;
  /** Expiration date (if present) */
  expiresAt?: Date;
  /** Issuance date */
  issuedAt?: Date;
}

/**
 * Configuration for JWT-VC verifier.
 */
export interface JwtVcVerifierConfig {
  /** List of trusted issuer DIDs */
  trustedIssuers: string[];
  /** Allowed clock skew in milliseconds (default: 60000) */
  clockSkewMs?: number;
}
