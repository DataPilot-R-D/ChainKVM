/**
 * Test helpers for JWT-VC verifier tests.
 */
import { vi } from 'vitest';
import * as jose from 'jose';
import { base58btc } from 'multiformats/bases/base58';
import type { DIDKeyResolver } from '../../identity/index.js';
import type { DIDDocument, DIDResolutionResult } from '../../identity/types.js';

export const TEST_ISSUER_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
export const UNTRUSTED_ISSUER_DID = 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH';

export let testKeyPair: Awaited<ReturnType<typeof jose.generateKeyPair>>;
export let testPublicKeyMultibase: string;

/** Initialize test key pair. Must be called in beforeAll. */
export async function initTestKeys(): Promise<void> {
  testKeyPair = await jose.generateKeyPair('EdDSA', { crv: 'Ed25519' });
  testPublicKeyMultibase = await jwkToMultibase(testKeyPair.publicKey);
}

/** Create a mock DID resolver. */
export function createMockResolver(publicKeyMultibase: string): DIDKeyResolver {
  const didDocument: DIDDocument = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: TEST_ISSUER_DID,
    verificationMethod: [{
      id: `${TEST_ISSUER_DID}#key-1`,
      type: 'Ed25519VerificationKey2020',
      controller: TEST_ISSUER_DID,
      publicKeyMultibase,
    }],
    authentication: [`${TEST_ISSUER_DID}#key-1`],
    assertionMethod: [`${TEST_ISSUER_DID}#key-1`],
  };

  const result: DIDResolutionResult = {
    didResolutionMetadata: { contentType: 'application/did+ld+json' },
    didDocument,
    didDocumentMetadata: {},
  };

  return {
    parse: vi.fn(),
    resolve: vi.fn().mockReturnValue(result),
    clearCache: vi.fn(),
  };
}

/** Create a valid JWT-VC for testing. */
export async function createTestJwtVc(options: {
  issuer?: string;
  subject?: string;
  exp?: number;
  nbf?: number;
  vc?: object;
} = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: options.issuer ?? TEST_ISSUER_DID,
    sub: options.subject ?? 'did:key:z6MksubjectDID',
    iat: now,
    exp: options.exp ?? now + 3600,
    nbf: options.nbf,
    vc: options.vc ?? {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'OperatorCredential'],
      issuer: options.issuer ?? TEST_ISSUER_DID,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: options.subject ?? 'did:key:z6MksubjectDID',
        role: 'operator',
      },
    },
  };

  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(testKeyPair.privateKey);
}

/** Convert JWK to multibase format for DID document. */
async function jwkToMultibase(
  publicKey: Awaited<ReturnType<typeof jose.importJWK>>
): Promise<string> {
  const jwk = await jose.exportJWK(publicKey);
  const rawKey = jose.base64url.decode(jwk.x!);
  // Ed25519 multicodec prefix: 0xed with varint encoding = [0xed, 0x01]
  const prefixed = new Uint8Array([0xed, 0x01, ...rawKey]);
  return base58btc.encode(prefixed);
}
