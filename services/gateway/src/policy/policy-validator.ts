/**
 * Policy validation utilities.
 */

import type { ConditionOperator } from './types.js';

const VALID_OPERATORS: ConditionOperator[] = [
  'eq', 'neq', 'in', 'gt', 'lt', 'gte', 'lte', 'contains',
];

const ACTION_PATTERN = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/;

/** Validation result with errors. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate a policy condition. */
export function validateCondition(condition: unknown, index: number): string[] {
  const prefix = `condition[${index}]`;

  if (!condition || typeof condition !== 'object') {
    return [`${prefix}: must be an object`];
  }

  const c = condition as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof c.field !== 'string' || c.field.length === 0) {
    errors.push(`${prefix}.field: must be a non-empty string`);
  }

  if (!VALID_OPERATORS.includes(c.operator as ConditionOperator)) {
    errors.push(`${prefix}.operator: must be one of ${VALID_OPERATORS.join(', ')}`);
  }

  if (c.value === undefined || c.value === null) {
    errors.push(`${prefix}.value: is required`);
  }

  return errors;
}

/** Validate a policy rule. */
export function validateRule(rule: unknown, index: number): string[] {
  const prefix = `rule[${index}]`;

  if (!rule || typeof rule !== 'object') {
    return [`${prefix}: must be an object`];
  }

  const r = rule as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof r.id !== 'string' || r.id.length === 0) {
    errors.push(`${prefix}.id: must be a non-empty string`);
  }

  if (r.effect !== 'allow' && r.effect !== 'deny') {
    errors.push(`${prefix}.effect: must be 'allow' or 'deny'`);
  }

  if (!Array.isArray(r.conditions)) {
    errors.push(`${prefix}.conditions: must be an array`);
  } else {
    const conditionErrors = r.conditions.flatMap((c, i) =>
      validateCondition(c, i).map((e) => `${prefix}.${e}`)
    );
    errors.push(...conditionErrors);
  }

  if (!Array.isArray(r.actions) || r.actions.length === 0) {
    errors.push(`${prefix}.actions: must be a non-empty array`);
  } else {
    for (let i = 0; i < r.actions.length; i++) {
      const action = r.actions[i];
      if (typeof action !== 'string' || !ACTION_PATTERN.test(action)) {
        errors.push(`${prefix}.actions[${i}]: must match pattern 'namespace:action'`);
      }
    }
  }

  if (typeof r.priority !== 'number' || !Number.isInteger(r.priority)) {
    errors.push(`${prefix}.priority: must be an integer`);
  }

  return errors;
}

/** Validate a policy input. */
export function validatePolicyInput(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['policy must be an object'] };
  }

  const p = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof p.id !== 'string' || p.id.length === 0) {
    errors.push('id: must be a non-empty string');
  }

  if (typeof p.name !== 'string' || p.name.length === 0) {
    errors.push('name: must be a non-empty string');
  }

  if (!Array.isArray(p.rules)) {
    errors.push('rules: must be an array');
  } else if (p.rules.length === 0) {
    errors.push('rules: must have at least one rule');
  } else {
    const ruleErrors = p.rules.flatMap((rule, i) => validateRule(rule, i));
    errors.push(...ruleErrors);
  }

  return { valid: errors.length === 0, errors };
}

/** Validate an array of policy rules. */
export function validateRules(rules: unknown): ValidationResult {
  if (!Array.isArray(rules)) {
    return { valid: false, errors: ['rules must be an array'] };
  }

  const errors = rules.flatMap((rule, i) => validateRule(rule, i));
  return { valid: errors.length === 0, errors };
}
