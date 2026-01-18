/**
 * Credentials module public API.
 * Provides JWT-VC verification for Verifiable Credentials.
 */

export type {
  VerifiableCredential,
  CredentialSubject,
  JwtVcPayload,
  SupportedAlgorithm,
  VCVerificationResult,
  JwtVcVerifierConfig,
} from './types.js';

export { VCVerificationError, VCVerificationErrorCode } from './errors.js';

export {
  createJwtVcVerifier,
  type JwtVcVerifier,
  type CreateJwtVcVerifierOptions,
} from './jwt-vc-verifier.js';

export {
  createIssuerTrustList,
  type IssuerTrustConfig,
  type IssuerTrustList,
} from './issuer-trust.js';

export {
  extractCredentialForPolicy,
  CredentialExtractionError,
} from './credential-extractor.js';
