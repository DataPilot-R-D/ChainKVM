/**
 * Tests for credential extraction from JWT-VC for policy evaluation.
 */

import { describe, it, expect } from 'vitest';
import * as jose from 'jose';
import {
  extractCredentialForPolicy,
  CredentialExtractionError,
} from '../credential-extractor.js';

describe('extractCredentialForPolicy', () => {
  // Helper to create test JWT-VC
  async function createTestJwtVc(payload: object): Promise<string> {
    const { privateKey } = await jose.generateKeyPair('EdDSA');
    return new jose.SignJWT(payload as jose.JWTPayload)
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(privateKey);
  }

  it('extracts issuer and subject from JWT claims', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer123',
      sub: 'did:key:operator456',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: { id: 'did:key:operator456' },
      },
    });

    const result = extractCredentialForPolicy(jwtVc);

    expect(result.issuer).toBe('did:key:issuer123');
    expect(result.subject).toBe('did:key:operator456');
  });

  it('extracts role from credentialSubject', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer',
      sub: 'did:key:operator',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: {
          id: 'did:key:operator',
          role: 'admin',
        },
      },
    });

    const result = extractCredentialForPolicy(jwtVc);

    expect(result.role).toBe('admin');
  });

  it('extracts additional credentialSubject claims', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer',
      sub: 'did:key:operator',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: {
          id: 'did:key:operator',
          role: 'operator',
          department: 'engineering',
          clearanceLevel: 3,
        },
      },
    });

    const result = extractCredentialForPolicy(jwtVc);

    expect(result.department).toBe('engineering');
    expect(result.clearanceLevel).toBe(3);
  });

  it('handles missing role gracefully', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer',
      sub: 'did:key:operator',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: { id: 'did:key:operator' },
      },
    });

    const result = extractCredentialForPolicy(jwtVc);

    expect(result.role).toBeUndefined();
  });

  it('uses sub from credentialSubject.id if JWT sub is missing', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer',
      // No sub claim in JWT
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: { id: 'did:key:operator-from-vc' },
      },
    });

    const result = extractCredentialForPolicy(jwtVc);

    expect(result.subject).toBe('did:key:operator-from-vc');
  });

  it('throws CredentialExtractionError for malformed JWT', () => {
    expect(() => extractCredentialForPolicy('not.a.valid.jwt')).toThrow(
      CredentialExtractionError
    );
  });

  it('throws CredentialExtractionError for empty string', () => {
    expect(() => extractCredentialForPolicy('')).toThrow(
      CredentialExtractionError
    );
  });

  it('throws CredentialExtractionError for missing iss claim', async () => {
    const jwtVc = await createTestJwtVc({
      sub: 'did:key:operator',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: {},
      },
    });

    expect(() => extractCredentialForPolicy(jwtVc)).toThrow(
      CredentialExtractionError
    );
    expect(() => extractCredentialForPolicy(jwtVc)).toThrow(/missing issuer/);
  });

  it('throws CredentialExtractionError for missing vc claim', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer',
      sub: 'did:key:operator',
      // No vc claim
    });

    expect(() => extractCredentialForPolicy(jwtVc)).toThrow(
      CredentialExtractionError
    );
    expect(() => extractCredentialForPolicy(jwtVc)).toThrow(/missing vc claim/);
  });

  it('throws CredentialExtractionError for missing subject', async () => {
    const jwtVc = await createTestJwtVc({
      iss: 'did:key:issuer',
      // No sub
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: {}, // No id either
      },
    });

    expect(() => extractCredentialForPolicy(jwtVc)).toThrow(
      CredentialExtractionError
    );
    expect(() => extractCredentialForPolicy(jwtVc)).toThrow(/missing subject/);
  });
});
