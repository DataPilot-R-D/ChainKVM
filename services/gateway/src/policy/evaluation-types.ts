/**
 * Types for policy evaluation.
 */

/** Credential information extracted from a Verifiable Credential. */
export interface EvaluationCredential {
  /** DID of the credential issuer. */
  issuer: string;
  /** DID of the credential subject. */
  subject: string;
  /** Role from credentialSubject (optional). */
  role?: string;
  /** Additional fields from credentialSubject. */
  [key: string]: unknown;
}

/** Runtime context for policy evaluation. */
export interface EvaluationRuntimeContext {
  /** Timestamp of the evaluation. */
  time: Date;
  /** Resource being accessed (e.g., robot_id). */
  resource: string;
  /** Action being requested. */
  action: string;
  /** Additional context fields. */
  [key: string]: unknown;
}

/** Complete context for policy evaluation. */
export interface EvaluationContext {
  /** Credential information from the VC. */
  credential: EvaluationCredential;
  /** Runtime context. */
  context: EvaluationRuntimeContext;
}

/** Policy metadata included in evaluation results. */
export interface PolicyMetadata {
  /** Policy ID. */
  id: string;
  /** Policy version. */
  version: number;
  /** Policy hash for integrity. */
  hash: string;
}

/** Result of a policy evaluation. */
export interface EvaluationResult {
  /** The access decision. */
  decision: 'allow' | 'deny';
  /** ID of the rule that matched (if any). */
  matchedRule?: string;
  /** Reason for denial (for deny decisions). */
  reason?: string;
  /** Actions that are allowed (intersection with requested). */
  allowedActions: string[];
  /** Policy metadata. */
  policy: PolicyMetadata;
  /** When the evaluation was performed. */
  evaluatedAt: Date;
  /** Duration of evaluation in milliseconds. */
  durationMs: number;
}

/** Input for policy evaluation. */
export interface EvaluationInput {
  /** Actions being requested. */
  requestedActions: string[];
  /** Evaluation context. */
  context: EvaluationContext;
}
