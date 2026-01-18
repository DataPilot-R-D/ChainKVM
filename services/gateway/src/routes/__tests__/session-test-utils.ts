/**
 * Test utilities for session tests.
 */

import * as jose from 'jose';

let cachedKey: jose.KeyLike | null = null;

async function getTestKey(): Promise<jose.KeyLike> {
  if (!cachedKey) {
    const { privateKey } = await jose.generateKeyPair('EdDSA');
    cachedKey = privateKey;
  }
  return cachedKey;
}

export interface CreateTestVcOptions {
  issuer?: string;
  subject?: string;
  role?: string;
}

/**
 * Create a test JWT-VC for session creation.
 */
export async function createTestVc(options: CreateTestVcOptions = {}): Promise<string> {
  const {
    issuer = 'did:key:z6MkTestIssuer',
    subject = 'did:key:z6MkTestOperator',
    role = 'operator',
  } = options;

  const key = await getTestKey();

  return new jose.SignJWT({
    iss: issuer,
    sub: subject,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'OperatorCredential'],
      credentialSubject: {
        id: subject,
        role,
      },
    },
  } as jose.JWTPayload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}
