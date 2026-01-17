/**
 * Condition evaluation logic for policy rules.
 */

import type { PolicyCondition } from './types.js';
import type { EvaluationContext } from './evaluation-types.js';

/**
 * Get a field value from the evaluation context using dot notation.
 * @param path - Field path (e.g., 'credential.role', 'context.time')
 * @param context - Evaluation context
 * @returns The field value or undefined if not found
 */
export function getFieldValue(
  path: string,
  context: EvaluationContext
): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value contains another value.
 * Works for both strings and arrays.
 */
function contains(fieldValue: unknown, value: unknown): boolean {
  if (typeof fieldValue === 'string' && typeof value === 'string') {
    return fieldValue.includes(value);
  }
  if (Array.isArray(fieldValue)) {
    return fieldValue.includes(value);
  }
  return false;
}

/**
 * Evaluate a single policy condition against the context.
 * @param condition - The condition to evaluate
 * @param context - The evaluation context
 * @returns true if condition matches, false otherwise
 */
export function evaluateCondition(
  condition: PolicyCondition,
  context: EvaluationContext
): boolean {
  const fieldValue = getFieldValue(condition.field, context);

  if (fieldValue === undefined) return false;

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) &&
        condition.value.includes(fieldValue as string);
    case 'gt':
      return (fieldValue as number) > (condition.value as number);
    case 'lt':
      return (fieldValue as number) < (condition.value as number);
    case 'gte':
      return (fieldValue as number) >= (condition.value as number);
    case 'lte':
      return (fieldValue as number) <= (condition.value as number);
    case 'contains':
      return contains(fieldValue, condition.value);
    default:
      return false;
  }
}
