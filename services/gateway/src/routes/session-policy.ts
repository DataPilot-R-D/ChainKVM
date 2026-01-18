/**
 * Policy evaluation and token helpers for session management.
 */

import type { PolicyEvaluator, PolicyStore, EvaluationContext, Policy } from '../policy/index.js';
import type { TokenRegistry } from '../tokens/index.js';
import type { EvaluationCredential } from '../credentials/index.js';
import { extractCredentialForPolicy, CredentialExtractionError } from '../credentials/index.js';

export const DEFAULT_POLICY_ID = 'default-policy';

/** Extract jti from JWT token (decode without verification). */
export function extractJtiFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.jti ?? null;
  } catch (error) {
    // Log decode failures for debugging (token may be malformed)
    console.debug('Failed to extract jti from token:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

/** Check if token is valid for the given session. */
export function isTokenValidForSession(
  token: string,
  sessionId: string,
  tokenRegistry: TokenRegistry | null
): boolean {
  if (!tokenRegistry) {
    console.warn('Token validation skipped: registry not configured');
    return true;
  }
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

/** Create development mode bypass result. */
function createDevModeResult(): PolicyEvaluationSuccess {
  console.warn('Policy evaluation skipped: policyEvaluator or policyStore not configured');
  return {
    success: true,
    policyResult: { policy_id: 'default-policy', version: '1.0.0', hash: 'no-policy-configured' },
  };
}

/** Build evaluation context from credential and input. */
function buildEvaluationContext(
  credential: EvaluationCredential,
  input: PolicyEvaluationInput
): EvaluationContext {
  return {
    credential: { issuer: credential.issuer, subject: credential.subject, role: credential.role },
    context: { time: new Date(), resource: input.robotId, action: input.requestedScope[0] },
  };
}

/** Create success result from policy. */
function createPolicySuccess(policy: Policy): PolicyEvaluationSuccess {
  return {
    success: true,
    policyResult: { policy_id: policy.id, version: String(policy.version), hash: policy.hash },
  };
}

/** Create policy denied failure result. */
function createPolicyDeniedError(reason?: string, matchedRule?: string): PolicyEvaluationFailure {
  return {
    success: false,
    error: {
      status: 403,
      body: { error: 'policy_denied', reason: reason ?? 'Access denied by policy', matched_rule: matchedRule },
    },
  };
}

/**
 * Evaluate policy for session creation.
 * Extracts credential claims and evaluates against configured policy.
 */
export function evaluateSessionPolicy(
  input: PolicyEvaluationInput,
  policyEvaluator: PolicyEvaluator | null,
  policyStore: PolicyStore | null
): PolicyEvaluationResult {
  if (!policyEvaluator || !policyStore) return createDevModeResult();

  let credential;
  try {
    credential = extractCredentialForPolicy(input.vcOrVp);
  } catch (error) {
    if (error instanceof CredentialExtractionError) {
      return { success: false, error: { status: 400, body: { error: 'invalid_credential', message: error.message } } };
    }
    throw error;
  }

  const policy = policyStore.get(DEFAULT_POLICY_ID);
  if (!policy) {
    return { success: false, error: { status: 500, body: { error: 'policy_not_configured', message: 'Default policy not found' } } };
  }

  const evalResult = policyEvaluator.evaluate(policy, buildEvaluationContext(credential, input), input.requestedScope);
  if (evalResult.decision === 'deny') return createPolicyDeniedError(evalResult.reason, evalResult.matchedRule);

  return createPolicySuccess(policy);
}
