/**
 * Policy evaluation and token helpers for session management.
 */

import type { PolicyEvaluator, PolicyStore, EvaluationContext } from '../policy/index.js';
import type { TokenRegistry } from '../tokens/index.js';
import { extractCredentialForPolicy, CredentialExtractionError } from '../credentials/index.js';

export const DEFAULT_POLICY_ID = 'default-policy';

/** Extract jti from JWT token (decode without verification). */
export function extractJtiFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.jti ?? null;
  } catch {
    return null;
  }
}

/** Check if token is valid for the given session. */
export function isTokenValidForSession(
  token: string,
  sessionId: string,
  tokenRegistry: TokenRegistry | null
): boolean {
  if (!tokenRegistry) return true; // Skip validation if registry not configured
  const jti = extractJtiFromToken(token);
  if (!jti) return false;
  const entry = tokenRegistry.get(jti);
  return entry !== undefined && entry.sessionId === sessionId && tokenRegistry.isValid(jti);
}

export interface PolicyEvaluationInput {
  vcOrVp: string;
  robotId: string;
  requestedScope: string[];
}

export interface PolicyEvaluationSuccess {
  success: true;
  policyResult: { policy_id: string; version: string; hash: string };
}

export interface PolicyEvaluationFailure {
  success: false;
  error: {
    status: number;
    body: { error: string; message?: string; reason?: string; matched_rule?: string };
  };
}

export type PolicyEvaluationResult = PolicyEvaluationSuccess | PolicyEvaluationFailure;

/**
 * Evaluate policy for session creation.
 * Extracts credential claims and evaluates against configured policy.
 * In development mode (no policy configured), skips validation entirely.
 */
export function evaluateSessionPolicy(
  input: PolicyEvaluationInput,
  policyEvaluator: PolicyEvaluator | null,
  policyStore: PolicyStore | null
): PolicyEvaluationResult {
  // Skip policy evaluation if not configured (development mode)
  if (!policyEvaluator || !policyStore) {
    return {
      success: true,
      policyResult: { policy_id: 'default-policy', version: '1.0.0', hash: 'no-policy-configured' },
    };
  }

  // Extract credential claims
  let credential;
  try {
    credential = extractCredentialForPolicy(input.vcOrVp);
  } catch (error) {
    if (error instanceof CredentialExtractionError) {
      return {
        success: false,
        error: {
          status: 400,
          body: { error: 'invalid_credential', message: error.message },
        },
      };
    }
    throw error;
  }

  // Get default policy
  const policy = policyStore.get(DEFAULT_POLICY_ID);
  if (!policy) {
    return {
      success: false,
      error: {
        status: 500,
        body: { error: 'policy_not_configured', message: 'Default policy not found' },
      },
    };
  }

  // Build evaluation context
  const evaluationContext: EvaluationContext = {
    credential: {
      issuer: credential.issuer,
      subject: credential.subject,
      role: credential.role,
    },
    context: {
      time: new Date(),
      resource: input.robotId,
      action: input.requestedScope[0],
    },
  };

  // Evaluate policy
  const evalResult = policyEvaluator.evaluate(policy, evaluationContext, input.requestedScope);

  if (evalResult.decision === 'deny') {
    return {
      success: false,
      error: {
        status: 403,
        body: {
          error: 'policy_denied',
          reason: evalResult.reason ?? 'Access denied by policy',
          matched_rule: evalResult.matchedRule,
        },
      },
    };
  }

  return {
    success: true,
    policyResult: {
      policy_id: policy.id,
      version: String(policy.version),
      hash: policy.hash,
    },
  };
}
