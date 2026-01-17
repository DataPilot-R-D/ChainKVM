import { describe, it, expect } from 'vitest';
import { evaluateCondition, getFieldValue } from '../condition-evaluator.js';
import type { PolicyCondition } from '../types.js';
import type { EvaluationContext } from '../evaluation-types.js';

const createContext = (
  overrides: Partial<EvaluationContext> = {}
): EvaluationContext => ({
  credential: {
    issuer: 'did:key:issuer123',
    subject: 'did:key:subject456',
    role: 'operator',
    ...overrides.credential,
  },
  context: {
    time: new Date('2024-01-15T10:00:00Z'),
    resource: 'robot-1',
    action: 'teleop:control',
    ...overrides.context,
  },
});

/** Create context with custom credential fields for numeric/array tests. */
function createCredentialContext(
  fields: Record<string, unknown>
): EvaluationContext {
  return createContext({
    credential: {
      issuer: 'did:key:issuer',
      subject: 'did:key:subject',
      ...fields,
    },
  });
}

describe('getFieldValue', () => {
  const ctx = createContext();

  it('should get top-level credential field', () => {
    expect(getFieldValue('credential.issuer', ctx)).toBe('did:key:issuer123');
  });

  it('should get nested credential field', () => {
    expect(getFieldValue('credential.role', ctx)).toBe('operator');
  });

  it('should get context field', () => {
    expect(getFieldValue('context.resource', ctx)).toBe('robot-1');
  });

  it('should return undefined for missing field', () => {
    expect(getFieldValue('credential.nonexistent', ctx)).toBeUndefined();
  });

  it('should return undefined for invalid path', () => {
    expect(getFieldValue('invalid.path.deep', ctx)).toBeUndefined();
  });

  it('should handle deep nested fields', () => {
    const nestedCtx = createContext({
      credential: {
        issuer: 'did:key:issuer',
        subject: 'did:key:subject',
        details: { level: 5, clearance: 'high' },
      },
    });
    expect(getFieldValue('credential.details.level', nestedCtx)).toBe(5);
  });
});

describe('evaluateCondition', () => {
  const ctx = createContext();

  describe('eq operator', () => {
    it('should return true when values match', () => {
      const condition: PolicyCondition = {
        field: 'credential.role',
        operator: 'eq',
        value: 'operator',
      };
      expect(evaluateCondition(condition, ctx)).toBe(true);
    });

    it('should return false when values differ', () => {
      const condition: PolicyCondition = {
        field: 'credential.role',
        operator: 'eq',
        value: 'admin',
      };
      expect(evaluateCondition(condition, ctx)).toBe(false);
    });
  });

  describe('neq operator', () => {
    it('should return true when values differ', () => {
      const condition: PolicyCondition = {
        field: 'credential.role',
        operator: 'neq',
        value: 'admin',
      };
      expect(evaluateCondition(condition, ctx)).toBe(true);
    });

    it('should return false when values match', () => {
      const condition: PolicyCondition = {
        field: 'credential.role',
        operator: 'neq',
        value: 'operator',
      };
      expect(evaluateCondition(condition, ctx)).toBe(false);
    });
  });

  describe('in operator', () => {
    it('should return true when value is in array', () => {
      const condition: PolicyCondition = {
        field: 'credential.role',
        operator: 'in',
        value: ['admin', 'operator', 'viewer'],
      };
      expect(evaluateCondition(condition, ctx)).toBe(true);
    });

    it('should return false when value not in array', () => {
      const condition: PolicyCondition = {
        field: 'credential.role',
        operator: 'in',
        value: ['admin', 'viewer'],
      };
      expect(evaluateCondition(condition, ctx)).toBe(false);
    });
  });

  describe('gt operator', () => {
    it('should return true when field > value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'gt',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 10 }))).toBe(true);
    });

    it('should return false when field <= value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'gt',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 5 }))).toBe(false);
    });
  });

  describe('lt operator', () => {
    it('should return true when field < value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'lt',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 3 }))).toBe(true);
    });

    it('should return false when field >= value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'lt',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 5 }))).toBe(false);
    });
  });

  describe('gte operator', () => {
    it('should return true when field >= value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'gte',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 5 }))).toBe(true);
    });

    it('should return false when field < value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'gte',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 4 }))).toBe(false);
    });
  });

  describe('lte operator', () => {
    it('should return true when field <= value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'lte',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 5 }))).toBe(true);
    });

    it('should return false when field > value', () => {
      const condition: PolicyCondition = {
        field: 'credential.level',
        operator: 'lte',
        value: 5,
      };
      expect(evaluateCondition(condition, createCredentialContext({ level: 6 }))).toBe(false);
    });
  });

  describe('contains operator', () => {
    it('should return true when string contains substring', () => {
      const condition: PolicyCondition = {
        field: 'credential.issuer',
        operator: 'contains',
        value: 'issuer',
      };
      expect(evaluateCondition(condition, ctx)).toBe(true);
    });

    it('should return false when string does not contain substring', () => {
      const condition: PolicyCondition = {
        field: 'credential.issuer',
        operator: 'contains',
        value: 'admin',
      };
      expect(evaluateCondition(condition, ctx)).toBe(false);
    });

    it('should return true when array contains value', () => {
      const condition: PolicyCondition = {
        field: 'credential.permissions',
        operator: 'contains',
        value: 'write',
      };
      const arrayCtx = createCredentialContext({ permissions: ['read', 'write', 'delete'] });
      expect(evaluateCondition(condition, arrayCtx)).toBe(true);
    });

    it('should return false when array does not contain value', () => {
      const condition: PolicyCondition = {
        field: 'credential.permissions',
        operator: 'contains',
        value: 'admin',
      };
      const arrayCtx = createCredentialContext({ permissions: ['read', 'write'] });
      expect(evaluateCondition(condition, arrayCtx)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for missing field', () => {
      const condition: PolicyCondition = {
        field: 'credential.nonexistent',
        operator: 'eq',
        value: 'test',
      };
      expect(evaluateCondition(condition, ctx)).toBe(false);
    });

    it('should handle boolean values', () => {
      const condition: PolicyCondition = {
        field: 'credential.active',
        operator: 'eq',
        value: true,
      };
      expect(evaluateCondition(condition, createCredentialContext({ active: true }))).toBe(true);
    });

    it('should handle numeric string comparisons', () => {
      const condition: PolicyCondition = {
        field: 'context.resource',
        operator: 'eq',
        value: 'robot-1',
      };
      expect(evaluateCondition(condition, ctx)).toBe(true);
    });
  });
});
