/**
 * Policy-related error types.
 */

/** Error codes for policy operations. */
export enum PolicyErrorCode {
  NOT_FOUND = 'policy_not_found',
  ALREADY_EXISTS = 'policy_already_exists',
  INVALID_POLICY = 'invalid_policy',
  INVALID_RULE = 'invalid_rule',
  MAX_POLICIES_EXCEEDED = 'max_policies_exceeded',
}

/** Error thrown by policy operations. */
export class PolicyError extends Error {
  constructor(
    public readonly code: PolicyErrorCode,
    message: string,
    public readonly policyId?: string
  ) {
    super(message);
    this.name = 'PolicyError';
  }

  /** Policy not found error. */
  static notFound(id: string): PolicyError {
    return new PolicyError(
      PolicyErrorCode.NOT_FOUND,
      `Policy not found: ${id}`,
      id
    );
  }

  /** Policy already exists error. */
  static alreadyExists(id: string): PolicyError {
    return new PolicyError(
      PolicyErrorCode.ALREADY_EXISTS,
      `Policy already exists: ${id}`,
      id
    );
  }

  /** Invalid policy error. */
  static invalidPolicy(reason: string, id?: string): PolicyError {
    return new PolicyError(
      PolicyErrorCode.INVALID_POLICY,
      `Invalid policy: ${reason}`,
      id
    );
  }

  /** Invalid rule error. */
  static invalidRule(ruleId: string, reason: string): PolicyError {
    return new PolicyError(
      PolicyErrorCode.INVALID_RULE,
      `Invalid rule '${ruleId}': ${reason}`
    );
  }

  /** Max policies exceeded error. */
  static maxPoliciesExceeded(max: number): PolicyError {
    return new PolicyError(
      PolicyErrorCode.MAX_POLICIES_EXCEEDED,
      `Maximum number of policies exceeded: ${max}`
    );
  }
}
