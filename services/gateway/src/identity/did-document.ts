/**
 * W3C DID Document builder for did:key method.
 */

import type { DIDDocument, ParsedDIDKey, VerificationMethod } from './types.js';
import { DID_CONTEXTS, ED25519_VERIFICATION_TYPE } from './multicodec.js';

/**
 * Build a verification method for an Ed25519 key.
 */
function buildVerificationMethod(parsed: ParsedDIDKey): VerificationMethod {
  const verificationMethodId = `${parsed.did}#${parsed.identifier}`;

  return {
    id: verificationMethodId,
    type: ED25519_VERIFICATION_TYPE,
    controller: parsed.did,
    publicKeyMultibase: parsed.identifier,
  };
}

/**
 * Build a W3C-compliant DID Document from a parsed did:key.
 */
export function buildDIDDocument(parsed: ParsedDIDKey): DIDDocument {
  const verificationMethod = buildVerificationMethod(parsed);
  const verificationMethodRef = verificationMethod.id;

  return {
    '@context': [...DID_CONTEXTS],
    id: parsed.did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethodRef],
    assertionMethod: [verificationMethodRef],
  };
}
