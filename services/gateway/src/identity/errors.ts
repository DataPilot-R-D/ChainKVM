/**
 * Custom error classes for DID resolution failures.
 */

/** Error codes for DID resolution failures */
export enum DIDResolutionErrorCode {
  INVALID_DID = 'invalidDid',
  UNSUPPORTED_METHOD = 'methodNotSupported',
  INVALID_PUBLIC_KEY = 'invalidPublicKey',
  UNSUPPORTED_KEY_TYPE = 'unsupportedPublicKeyType',
  INVALID_MULTIBASE = 'invalidMultibase',
}

/** Base error class for DID resolution failures */
export class DIDResolutionError extends Error {
  constructor(
    public readonly code: DIDResolutionErrorCode,
    message: string,
    public readonly did?: string
  ) {
    super(message);
    this.name = 'DIDResolutionError';
  }

  /** Create error for invalid DID format */
  static invalidDid(did: string, reason: string): DIDResolutionError {
    return new DIDResolutionError(
      DIDResolutionErrorCode.INVALID_DID,
      `Invalid DID format: ${reason}`,
      did
    );
  }

  /** Create error for unsupported DID method */
  static unsupportedMethod(did: string, method: string): DIDResolutionError {
    return new DIDResolutionError(
      DIDResolutionErrorCode.UNSUPPORTED_METHOD,
      `Unsupported DID method: ${method}. Only 'key' is supported.`,
      did
    );
  }

  /** Create error for unsupported key type */
  static unsupportedKeyType(did: string, codecPrefix: number): DIDResolutionError {
    const hex = '0x' + codecPrefix.toString(16);
    return new DIDResolutionError(
      DIDResolutionErrorCode.UNSUPPORTED_KEY_TYPE,
      `Unsupported key type with codec prefix ${hex}. Only Ed25519 (0xed) is supported.`,
      did
    );
  }

  /** Create error for invalid public key length */
  static invalidPublicKey(did: string, expected: number, actual: number): DIDResolutionError {
    return new DIDResolutionError(
      DIDResolutionErrorCode.INVALID_PUBLIC_KEY,
      `Invalid public key length: expected ${expected} bytes, got ${actual}`,
      did
    );
  }

  /** Create error for invalid multibase encoding */
  static invalidMultibase(did: string, reason: string): DIDResolutionError {
    return new DIDResolutionError(
      DIDResolutionErrorCode.INVALID_MULTIBASE,
      `Invalid multibase encoding: ${reason}`,
      did
    );
  }
}
