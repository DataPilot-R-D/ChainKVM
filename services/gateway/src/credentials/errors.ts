/**
 * VC verification error codes and classes.
 */

export enum VCVerificationErrorCode {
  INVALID_JWT = 'invalid_jwt',
  INVALID_SIGNATURE = 'invalid_signature',
  UNTRUSTED_ISSUER = 'untrusted_issuer',
  CREDENTIAL_EXPIRED = 'credential_expired',
  CREDENTIAL_NOT_YET_VALID = 'credential_not_yet_valid',
  ISSUER_RESOLUTION_FAILED = 'issuer_resolution_failed',
  UNSUPPORTED_ALGORITHM = 'unsupported_algorithm',
  MISSING_VC_CLAIM = 'missing_vc_claim',
}

/**
 * Error thrown during VC verification.
 */
export class VCVerificationError extends Error {
  constructor(
    public readonly code: VCVerificationErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'VCVerificationError';
  }

  static invalidJwt(message: string, cause?: Error): VCVerificationError {
    return new VCVerificationError(VCVerificationErrorCode.INVALID_JWT, message, cause);
  }

  static invalidSignature(): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.INVALID_SIGNATURE,
      'JWT signature verification failed'
    );
  }

  static untrustedIssuer(issuer: string): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.UNTRUSTED_ISSUER,
      `Issuer not in trusted list: ${issuer}`
    );
  }

  static credentialExpired(expiry: Date): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.CREDENTIAL_EXPIRED,
      `Credential expired at ${expiry.toISOString()}`
    );
  }

  static credentialNotYetValid(notBefore: Date): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.CREDENTIAL_NOT_YET_VALID,
      `Credential not valid until ${notBefore.toISOString()}`
    );
  }

  static issuerResolutionFailed(issuer: string, cause: Error): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.ISSUER_RESOLUTION_FAILED,
      `Failed to resolve issuer DID: ${issuer}`,
      cause
    );
  }

  static unsupportedAlgorithm(algorithm: string): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.UNSUPPORTED_ALGORITHM,
      `Unsupported JWT algorithm: ${algorithm}. Supported: EdDSA, ES256`
    );
  }

  static missingVcClaim(): VCVerificationError {
    return new VCVerificationError(
      VCVerificationErrorCode.MISSING_VC_CLAIM,
      'JWT payload missing required "vc" claim'
    );
  }
}
