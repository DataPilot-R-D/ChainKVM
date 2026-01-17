import { describe, it, expect } from 'vitest';
import {
  validatePolicyInput,
  validateRule,
  validateCondition,
  validateRules,
} from '../policy-validator.js';

describe('validateCondition', () => {
  it('should pass for valid condition', () => {
    const errors = validateCondition(
      { field: 'credential.role', operator: 'eq', value: 'admin' },
      0
    );
    expect(errors).toEqual([]);
  });

  it('should fail for non-object condition', () => {
    const errors = validateCondition('invalid', 0);
    expect(errors).toContain('condition[0]: must be an object');
  });

  it('should fail for missing field', () => {
    const errors = validateCondition({ operator: 'eq', value: 'test' }, 0);
    expect(errors).toContain('condition[0].field: must be a non-empty string');
  });

  it('should fail for invalid operator', () => {
    const errors = validateCondition(
      { field: 'test', operator: 'invalid', value: 'x' },
      0
    );
    expect(errors[0]).toContain('condition[0].operator');
  });

  it('should fail for missing value', () => {
    const errors = validateCondition({ field: 'test', operator: 'eq' }, 0);
    expect(errors).toContain('condition[0].value: is required');
  });
});

describe('validateRule', () => {
  const validRule = {
    id: 'rule-1',
    effect: 'allow',
    conditions: [{ field: 'role', operator: 'eq', value: 'admin' }],
    actions: ['teleop:view'],
    priority: 1,
  };

  it('should pass for valid rule', () => {
    const errors = validateRule(validRule, 0);
    expect(errors).toEqual([]);
  });

  it('should fail for missing id', () => {
    const errors = validateRule({ ...validRule, id: '' }, 0);
    expect(errors).toContain('rule[0].id: must be a non-empty string');
  });

  it('should fail for invalid effect', () => {
    const errors = validateRule({ ...validRule, effect: 'maybe' }, 0);
    expect(errors).toContain("rule[0].effect: must be 'allow' or 'deny'");
  });

  it('should fail for non-array conditions', () => {
    const errors = validateRule({ ...validRule, conditions: 'invalid' }, 0);
    expect(errors).toContain('rule[0].conditions: must be an array');
  });

  it('should fail for empty actions', () => {
    const errors = validateRule({ ...validRule, actions: [] }, 0);
    expect(errors).toContain('rule[0].actions: must be a non-empty array');
  });

  it('should fail for invalid action format', () => {
    const errors = validateRule({ ...validRule, actions: ['invalid'] }, 0);
    expect(errors[0]).toContain("must match pattern 'namespace:action'");
  });

  it('should fail for non-integer priority', () => {
    const errors = validateRule({ ...validRule, priority: 1.5 }, 0);
    expect(errors).toContain('rule[0].priority: must be an integer');
  });
});

describe('validatePolicyInput', () => {
  const validPolicy = {
    id: 'policy-1',
    name: 'Test Policy',
    rules: [
      {
        id: 'rule-1',
        effect: 'allow',
        conditions: [{ field: 'role', operator: 'eq', value: 'admin' }],
        actions: ['teleop:view'],
        priority: 1,
      },
    ],
  };

  it('should pass for valid policy', () => {
    const result = validatePolicyInput(validPolicy);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should fail for non-object', () => {
    const result = validatePolicyInput('invalid');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('policy must be an object');
  });

  it('should fail for missing id', () => {
    const result = validatePolicyInput({ ...validPolicy, id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('id: must be a non-empty string');
  });

  it('should fail for missing name', () => {
    const result = validatePolicyInput({ ...validPolicy, name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name: must be a non-empty string');
  });

  it('should fail for empty rules', () => {
    const result = validatePolicyInput({ ...validPolicy, rules: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rules: must have at least one rule');
  });

  it('should collect errors from nested rules', () => {
    const result = validatePolicyInput({
      ...validPolicy,
      rules: [{ id: '', effect: 'invalid', conditions: [], actions: [], priority: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateRules', () => {
  it('should pass for valid rules array', () => {
    const result = validateRules([
      {
        id: 'rule-1',
        effect: 'deny',
        conditions: [],
        actions: ['admin:delete'],
        priority: 0,
      },
    ]);
    expect(result.valid).toBe(true);
  });

  it('should fail for non-array', () => {
    const result = validateRules('not-an-array');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rules must be an array');
  });
});
