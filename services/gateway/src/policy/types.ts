/**
 * Policy types for ABAC-style authorization.
 */

/** Policy rule effect - allow or deny access. */
export type PolicyEffect = 'allow' | 'deny';

/** Condition operators for policy evaluation. */
export type ConditionOperator = 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

/** A condition that must be met for a rule to apply. */
export interface PolicyCondition {
  /** Field path to evaluate (e.g., 'credential.role', 'context.time'). */
  field: string;
  /** Comparison operator. */
  operator: ConditionOperator;
  /** Value to compare against. */
  value: string | number | boolean | string[];
}

/** A single policy rule with conditions and effect. */
export interface PolicyRule {
  /** Unique identifier for the rule within the policy. */
  id: string;
  /** Effect when rule matches - allow or deny. */
  effect: PolicyEffect;
  /** Conditions that must all be true for rule to match. */
  conditions: PolicyCondition[];
  /** Actions this rule applies to (e.g., ['teleop:view', 'teleop:control']). */
  actions: string[];
  /** Priority for rule ordering. Lower number = higher priority. */
  priority: number;
  /** Optional human-readable description. */
  description?: string;
}

/** A complete policy with rules and metadata. */
export interface Policy {
  /** Unique policy identifier. */
  id: string;
  /** Policy version number (auto-incremented on update). */
  version: number;
  /** Human-readable policy name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Ordered list of policy rules. */
  rules: PolicyRule[];
  /** When the policy was created. */
  createdAt: Date;
  /** When the policy was last updated. */
  updatedAt: Date;
  /** SHA-256 hash of rules for integrity verification. */
  hash: string;
}

/** Input for creating a new policy. */
export interface CreatePolicyInput {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
}

/** Input for updating an existing policy. */
export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  rules?: PolicyRule[];
}

/** Configuration for the policy store. */
export interface PolicyStoreConfig {
  /** Maximum number of policies to store. Default: 10000. */
  maxPolicies?: number;
}

/** Policy store interface for CRUD operations. */
export interface PolicyStore {
  /** Get a policy by ID. Returns undefined if not found. */
  get(id: string): Policy | undefined;
  /** Get a specific version of a policy. */
  getByVersion(id: string, version: number): Policy | undefined;
  /** List all current policies. */
  list(): Policy[];
  /** Create a new policy. Throws if ID already exists. */
  create(input: CreatePolicyInput): Policy;
  /** Update an existing policy. Throws if not found. */
  update(id: string, updates: UpdatePolicyInput): Policy;
  /** Delete a policy. Returns true if deleted, false if not found. */
  delete(id: string): boolean;
  /** Get version history for a policy. */
  getVersionHistory(id: string): Policy[];
  /** Compute hash for policy rules. */
  computeHash(rules: PolicyRule[]): string;
  /** Clear all policies (for testing). */
  clear(): void;
}
