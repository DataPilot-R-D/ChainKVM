/**
 * Credential extraction for policy evaluation.
 * Decodes JWT-VC claims without signature verification.
 */

import * as jose from 'jose';
import type { EvaluationCredential } from '../policy/evaluation-types.js';
import type { JwtVcPayload, CredentialSubject } from './types.js';

/** Error thrown when credential extraction fails. */
export class CredentialExtractionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'CredentialExtractionError';
  }
}

/**
 * Extract credential claims from JWT-VC for policy evaluation.
 * Does NOT verify signature - use jwt-vc-verifier for that.
 *
 * @param jwtVc - JWT-encoded Verifiable Credential
 * @returns EvaluationCredential for policy evaluation
 * @throws CredentialExtractionError if JWT is malformed or missing required claims
 */
export function extractCredentialForPolicy(jwtVc: string): EvaluationCredential {
  if (!jwtVc) {
    throw new CredentialExtractionError('missing credential');
  }

  let payload: JwtVcPayload;
  try {
    payload = jose.decodeJwt(jwtVc) as unknown as JwtVcPayload;
  } catch (error) {
    throw new CredentialExtractionError(
      'failed to decode JWT',
      error instanceof Error ? error : undefined
    );
  }

  // Validate required claims
  if (!payload.iss) {
    throw new CredentialExtractionError('missing issuer (iss) claim');
  }

  if (!payload.vc) {
    throw new CredentialExtractionError('missing vc claim');
  }

  const credentialSubject = payload.vc.credentialSubject || {};
  const subject = payload.sub || credentialSubject.id;

  if (!subject) {
    throw new CredentialExtractionError('missing subject (sub or credentialSubject.id)');
  }

  // Build EvaluationCredential from claims
  return buildEvaluationCredential(payload.iss, subject, credentialSubject);
}

/**
 * Build EvaluationCredential from extracted claims.
 */
function buildEvaluationCredential(
  issuer: string,
  subject: string,
  credentialSubject: CredentialSubject
): EvaluationCredential {
  // Start with required fields
  const credential: EvaluationCredential = {
    issuer,
    subject,
  };

  // Add role if present
  if (typeof credentialSubject.role === 'string') {
    credential.role = credentialSubject.role;
  }

  // Copy additional claims from credentialSubject (except id)
  for (const [key, value] of Object.entries(credentialSubject)) {
    if (key !== 'id' && key !== 'role') {
      credential[key] = value;
    }
  }

  return credential;
}
