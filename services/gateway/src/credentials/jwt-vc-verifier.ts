/**
 * JWT-VC signature verification.
 * @see https://www.w3.org/TR/vc-data-model/#jwt-encoding
 */

import * as jose from 'jose';
import { base58btc } from 'multiformats/bases/base58';
import type { JwtVcPayload, JwtVcVerifierConfig, VCVerificationResult, SupportedAlgorithm } from './types.js';
import { VCVerificationError } from './errors.js';
import type { DIDKeyResolver } from '../identity/index.js';

const SUPPORTED_ALGORITHMS: SupportedAlgorithm[] = ['EdDSA', 'ES256'];
const DEFAULT_CLOCK_SKEW_MS = 60_000; // 1 minute

export interface JwtVcVerifier {
  verify(jwtVc: string): Promise<VCVerificationResult>;
}

export interface CreateJwtVcVerifierOptions extends JwtVcVerifierConfig {
  didResolver: DIDKeyResolver;
}

/** Extract issuer DID from JWT without verification. */
function extractIssuer(jwtVc: string): string {
  try {
    const payload = jose.decodeJwt(jwtVc) as JwtVcPayload;
    return payload.iss;
  } catch (error) {
    throw VCVerificationError.invalidJwt('Failed to decode JWT', error as Error);
  }
}

/** Check if algorithm is supported. */
function validateAlgorithm(header: jose.ProtectedHeaderParameters): void {
  const alg = header.alg as string;
  if (!SUPPORTED_ALGORITHMS.includes(alg as SupportedAlgorithm)) {
    throw VCVerificationError.unsupportedAlgorithm(alg);
  }
}

/** Check if issuer is in trusted list. */
function validateIssuerTrust(issuer: string, trustedIssuers: string[]): void {
  if (!trustedIssuers.includes(issuer)) {
    throw VCVerificationError.untrustedIssuer(issuer);
  }
}

/** Convert multibase public key to jose key format. */
async function multibaseToKey(
  publicKeyMultibase: string,
  algorithm: string
): Promise<jose.KeyLike> {
  const decoded = base58btc.decode(publicKeyMultibase);
  // Skip multicodec prefix (2 bytes for ed25519: 0xed01)
  const rawKey = decoded.slice(2);

  if (algorithm === 'EdDSA') {
    return jose.importJWK(
      { kty: 'OKP', crv: 'Ed25519', x: jose.base64url.encode(rawKey) },
      'EdDSA'
    );
  }
  if (algorithm === 'ES256') {
    return jose.importJWK(
      {
        kty: 'EC',
        crv: 'P-256',
        x: jose.base64url.encode(rawKey.slice(0, 32)),
        y: jose.base64url.encode(rawKey.slice(32, 64)),
      },
      'ES256'
    );
  }
  throw VCVerificationError.unsupportedAlgorithm(algorithm);
}

/** Resolve DID and extract verification method. */
function resolveVerificationMethod(
  issuer: string,
  didResolver: DIDKeyResolver
): { publicKeyMultibase: string } {
  const resolution = didResolver.resolve(issuer);
  if (!resolution.didDocument) {
    throw VCVerificationError.issuerResolutionFailed(
      issuer,
      new Error(resolution.didResolutionMetadata.error || 'Unknown resolution error')
    );
  }

  const verificationMethod = resolution.didDocument.verificationMethod[0];
  if (!verificationMethod) {
    throw VCVerificationError.issuerResolutionFailed(
      issuer,
      new Error('No verification method in DID document')
    );
  }

  return verificationMethod;
}

/** Verify JWT signature and return payload. */
async function verifyJwtSignature(
  jwtVc: string,
  publicKey: jose.KeyLike,
  clockSkewMs: number
): Promise<JwtVcPayload> {
  try {
    const result = await jose.jwtVerify(jwtVc, publicKey, {
      algorithms: SUPPORTED_ALGORITHMS,
      clockTolerance: Math.ceil(clockSkewMs / 1000),
    });
    return result.payload as unknown as JwtVcPayload;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      const exp = jose.decodeJwt(jwtVc).exp as number;
      throw VCVerificationError.credentialExpired(new Date(exp * 1000));
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      const nbf = jose.decodeJwt(jwtVc).nbf as number;
      if (nbf) {
        throw VCVerificationError.credentialNotYetValid(new Date(nbf * 1000));
      }
    }
    // All other jose errors are signature failures
    throw VCVerificationError.invalidSignature();
  }
}

/** Build verification result from validated payload. */
function buildResult(payload: JwtVcPayload): VCVerificationResult {
  return {
    valid: true,
    credential: payload.vc,
    issuer: payload.iss,
    subject: payload.sub,
    expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
    issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
  };
}

/**
 * Create a JWT-VC verifier.
 */
export function createJwtVcVerifier(options: CreateJwtVcVerifierOptions): JwtVcVerifier {
  const { trustedIssuers, didResolver, clockSkewMs = DEFAULT_CLOCK_SKEW_MS } = options;

  return {
    async verify(jwtVc: string): Promise<VCVerificationResult> {
      const issuer = extractIssuer(jwtVc);
      validateIssuerTrust(issuer, trustedIssuers);

      const verificationMethod = resolveVerificationMethod(issuer, didResolver);

      const header = jose.decodeProtectedHeader(jwtVc);
      validateAlgorithm(header);

      const publicKey = await multibaseToKey(verificationMethod.publicKeyMultibase, header.alg!);
      const payload = await verifyJwtSignature(jwtVc, publicKey, clockSkewMs);

      if (!payload.vc) {
        throw VCVerificationError.missingVcClaim();
      }

      return buildResult(payload);
    },
  };
}
