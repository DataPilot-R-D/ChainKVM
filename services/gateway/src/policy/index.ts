/**
 * Policy module public API.
 * Provides policy storage and validation for ABAC authorization.
 */

export type {
  Policy,
  PolicyRule,
  PolicyCondition,
  PolicyEffect,
  ConditionOperator,
  PolicyStore,
  PolicyStoreConfig,
  CreatePolicyInput,
  UpdatePolicyInput,
} from './types.js';

export { PolicyError, PolicyErrorCode } from './errors.js';

export { createPolicyStore } from './policy-store.js';

export {
  validatePolicyInput,
  validateRules,
  validateRule,
  validateCondition,
  type ValidationResult,
} from './policy-validator.js';
