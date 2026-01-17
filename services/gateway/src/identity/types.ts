/**
 * DID Resolution types following W3C DID Core specification.
 * @see https://www.w3.org/TR/did-core/
 */

/** Verification relationship types in a DID Document */
export type VerificationRelationship =
  | 'authentication'
  | 'assertionMethod'
  | 'keyAgreement'
  | 'capabilityInvocation'
  | 'capabilityDelegation';

/** A verification method within a DID Document */
export interface VerificationMethod {
  /** Unique identifier for this verification method */
  id: string;
  /** Type of cryptographic key (e.g., Ed25519VerificationKey2020) */
  type: string;
  /** DID of the controller of this key */
  controller: string;
  /** Public key in multibase encoding */
  publicKeyMultibase: string;
}

/** W3C DID Document structure */
export interface DIDDocument {
  /** JSON-LD context */
  '@context': string[];
  /** The DID subject identifier */
  id: string;
  /** Verification methods for this DID */
  verificationMethod: VerificationMethod[];
  /** Authentication verification relationship */
  authentication: string[];
  /** Assertion method verification relationship */
  assertionMethod: string[];
  /** Optional: key agreement verification relationship */
  keyAgreement?: string[];
  /** Optional: capability invocation verification relationship */
  capabilityInvocation?: string[];
  /** Optional: capability delegation verification relationship */
  capabilityDelegation?: string[];
}

/** Metadata about the DID resolution process */
export interface DIDResolutionMetadata {
  /** Content type of the DID Document */
  contentType?: string;
  /** Duration of resolution in milliseconds */
  duration?: number;
  /** Error code if resolution failed */
  error?: string;
  /** Whether result came from cache */
  cached?: boolean;
}

/** Metadata about the DID Document */
export interface DIDDocumentMetadata {
  /** Timestamp when the DID was created */
  created?: string;
  /** Timestamp when the DID was last updated */
  updated?: string;
  /** Whether this DID has been deactivated */
  deactivated?: boolean;
}

/** Complete result of DID resolution */
export interface DIDResolutionResult {
  /** Metadata about the resolution process */
  didResolutionMetadata: DIDResolutionMetadata;
  /** The resolved DID Document (null if resolution failed) */
  didDocument: DIDDocument | null;
  /** Metadata about the DID Document */
  didDocumentMetadata: DIDDocumentMetadata;
}

/** Parsed components of a did:key identifier */
export interface ParsedDIDKey {
  /** Full DID string */
  did: string;
  /** DID method (always 'key' for did:key) */
  method: 'key';
  /** Method-specific identifier (the multibase-encoded key) */
  identifier: string;
  /** Multicodec prefix indicating key type */
  codecPrefix: number;
  /** Raw public key bytes */
  publicKey: Uint8Array;
}

/** Supported key types for did:key method */
export type KeyType = 'Ed25519';

/** Configuration for DID resolver cache */
export interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Maximum number of cached entries */
  maxSize: number;
}
