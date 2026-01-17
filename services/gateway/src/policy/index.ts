/**
 * Policy module public API.
 * Provides policy storage, validation, and evaluation for ABAC authorization.
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

export type {
  EvaluationContext,
  EvaluationCredential,
  EvaluationRuntimeContext,
  EvaluationResult,
  EvaluationInput,
  PolicyMetadata,
} from './evaluation-types.js';

export { PolicyError, PolicyErrorCode } from './errors.js';

export { createPolicyStore } from './policy-store.js';

export {
  validatePolicyInput,
  validateRules,
  validateRule,
  validateCondition,
  type ValidationResult,
} from './policy-validator.js';

export {
  createPolicyEvaluator,
  type PolicyEvaluator,
} from './policy-evaluator.js';

export { evaluateCondition, getFieldValue } from './condition-evaluator.js';
