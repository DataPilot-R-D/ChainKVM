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
): Promise<Awaited<ReturnType<typeof jose.importJWK>>> {
  const decoded = base58btc.decode(publicKeyMultibase);
  // Skip multicodec prefix (2 bytes for ed25519: 0xed01)
  const rawKey = decoded.slice(2);

  if (algorithm === 'EdDSA') {
    return jose.importJWK(
      { kty: 'OKP', crv: 'Ed25519', x: jose.base64url.encode(rawKey) },
      'EdDSA'
    );
  } else if (algorithm === 'ES256') {
    // ES256 uses P-256 curve, requires 65-byte uncompressed or 33-byte compressed key
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

/**
 * Create a JWT-VC verifier.
 */
export function createJwtVcVerifier(options: CreateJwtVcVerifierOptions): JwtVcVerifier {
  const { trustedIssuers, didResolver, clockSkewMs = DEFAULT_CLOCK_SKEW_MS } = options;

  return {
    async verify(jwtVc: string): Promise<VCVerificationResult> {
      // 1. Extract issuer without verification
      const issuer = extractIssuer(jwtVc);

      // 2. Validate issuer is trusted
      validateIssuerTrust(issuer, trustedIssuers);

      // 3. Resolve issuer DID to get public key
      const resolution = didResolver.resolve(issuer);
      if (!resolution.didDocument) {
        throw VCVerificationError.issuerResolutionFailed(
          issuer,
          new Error(resolution.didResolutionMetadata.error || 'Unknown resolution error')
        );
      }

      // 4. Get verification method public key
      const verificationMethod = resolution.didDocument.verificationMethod[0];
      if (!verificationMethod) {
        throw VCVerificationError.issuerResolutionFailed(
          issuer,
          new Error('No verification method in DID document')
        );
      }

      // 5. Get JWT header to determine algorithm
      const header = jose.decodeProtectedHeader(jwtVc);
      validateAlgorithm(header);
      const algorithm = header.alg!; // Safe after validateAlgorithm

      // 6. Import public key
      const publicKey = await multibaseToKey(verificationMethod.publicKeyMultibase, algorithm);

      // 7. Verify signature (let jose handle clock tolerance)
      let payload: JwtVcPayload;
      try {
        const result = await jose.jwtVerify(jwtVc, publicKey, {
          algorithms: SUPPORTED_ALGORITHMS,
          clockTolerance: Math.ceil(clockSkewMs / 1000),
        });
        payload = result.payload as unknown as JwtVcPayload;
      } catch (error) {
        // Distinguish between signature errors and temporal errors
        if (error instanceof jose.errors.JWTExpired) {
          const exp = jose.decodeJwt(jwtVc).exp as number;
          throw VCVerificationError.credentialExpired(new Date(exp * 1000));
        }
        if (error instanceof jose.errors.JWTClaimValidationFailed) {
          const nbf = jose.decodeJwt(jwtVc).nbf as number;
          if (nbf) throw VCVerificationError.credentialNotYetValid(new Date(nbf * 1000));
        }
        throw VCVerificationError.invalidSignature();
      }

      // 8. Validate vc claim exists
      if (!payload.vc) {
        throw VCVerificationError.missingVcClaim();
      }

      // 10. Build result
      return {
        valid: true,
        credential: payload.vc,
        issuer: payload.iss,
        subject: payload.sub,
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
        issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
      };
    },
  };
}
