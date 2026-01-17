import { describe, it, expect, beforeEach } from 'vitest';
import { createPolicyEvaluator } from '../policy-evaluator.js';
import type { PolicyEvaluator } from '../policy-evaluator.js';
import type { Policy, PolicyRule } from '../types.js';
import type { EvaluationContext } from '../evaluation-types.js';

const createTestPolicy = (rules: PolicyRule[]): Policy => ({
  id: 'test-policy',
  version: 1,
  name: 'Test Policy',
  rules,
  createdAt: new Date(),
  updatedAt: new Date(),
  hash: 'testhash123',
});

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

describe('createPolicyEvaluator', () => {
  let evaluator: PolicyEvaluator;

  beforeEach(() => {
    evaluator = createPolicyEvaluator();
  });

  describe('allow rule matching', () => {
    it('should return allow when rule conditions match', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-operators',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:control', 'teleop:view'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('allow');
      expect(result.matchedRule).toBe('allow-operators');
      expect(result.allowedActions).toEqual(['teleop:control']);
    });

    it('should return intersection of requested and rule actions', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-view-only',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:view'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(
        policy,
        createContext(),
        ['teleop:control', 'teleop:view']
      );

      expect(result.decision).toBe('allow');
      expect(result.allowedActions).toEqual(['teleop:view']);
    });
  });

  describe('deny rule matching', () => {
    it('should return deny when deny rule matches', () => {
      const policy = createTestPolicy([
        {
          id: 'deny-guests',
          effect: 'deny',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'guest' }],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const ctx = createContext({ credential: { issuer: 'x', subject: 'y', role: 'guest' } });
      const result = evaluator.evaluate(policy, ctx, ['teleop:control']);

      expect(result.decision).toBe('deny');
      expect(result.matchedRule).toBe('deny-guests');
      expect(result.allowedActions).toEqual([]);
    });
  });

  describe('first-deny-wins semantics', () => {
    it('should deny even if allow rule exists with same priority', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-all',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:control'],
          priority: 1,
        },
        {
          id: 'deny-robot1',
          effect: 'deny',
          conditions: [{ field: 'context.resource', operator: 'eq', value: 'robot-1' }],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('deny');
      expect(result.matchedRule).toBe('deny-robot1');
    });

    it('should allow if deny rule does not match', () => {
      const policy = createTestPolicy([
        {
          id: 'deny-guests',
          effect: 'deny',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'guest' }],
          actions: ['teleop:control'],
          priority: 1,
        },
        {
          id: 'allow-operators',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:control'],
          priority: 2,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('allow');
      expect(result.matchedRule).toBe('allow-operators');
    });
  });

  describe('default deny semantics', () => {
    it('should deny when no rules match', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-admins',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'admin' }],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('deny');
      expect(result.matchedRule).toBeUndefined();
      expect(result.reason).toBe('no matching rule');
    });

    it('should deny when policy has no rules', () => {
      const policy = createTestPolicy([]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('no matching rule');
    });
  });

  describe('priority ordering', () => {
    it('should evaluate lower priority (higher number) rules first', () => {
      const policy = createTestPolicy([
        {
          id: 'high-priority-allow',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:control'],
          priority: 1,
        },
        {
          id: 'low-priority-deny',
          effect: 'deny',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:control'],
          priority: 10,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      // Priority 1 deny check first (no match), then priority 10 deny check (matches)
      // Wait - actually deny rules are checked first across all priorities
      // So the deny rule at priority 10 matches first
      expect(result.decision).toBe('deny');
    });

    it('should use priority to order rules within same effect', () => {
      const policy = createTestPolicy([
        {
          id: 'priority-10-allow',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:view'],
          priority: 10,
        },
        {
          id: 'priority-1-allow',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:control', 'teleop:view'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      // First allow rule to match wins (priority 1 comes first)
      expect(result.matchedRule).toBe('priority-1-allow');
    });
  });

  describe('multiple conditions (AND logic)', () => {
    it('should require all conditions to match', () => {
      const policy = createTestPolicy([
        {
          id: 'multi-condition',
          effect: 'allow',
          conditions: [
            { field: 'credential.role', operator: 'eq', value: 'operator' },
            { field: 'context.resource', operator: 'eq', value: 'robot-1' },
          ],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('allow');
    });

    it('should deny when any condition fails', () => {
      const policy = createTestPolicy([
        {
          id: 'multi-condition',
          effect: 'allow',
          conditions: [
            { field: 'credential.role', operator: 'eq', value: 'operator' },
            { field: 'context.resource', operator: 'eq', value: 'robot-2' },
          ],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('no matching rule');
    });
  });

  describe('action matching', () => {
    it('should not match if action not in rule actions', () => {
      const policy = createTestPolicy([
        {
          id: 'view-only',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:view'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('no matching rule');
    });

    it('should match if any requested action is in rule actions', () => {
      const policy = createTestPolicy([
        {
          id: 'view-only',
          effect: 'allow',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
          actions: ['teleop:view'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(
        policy,
        createContext(),
        ['teleop:control', 'teleop:view']
      );

      expect(result.decision).toBe('allow');
      expect(result.allowedActions).toEqual(['teleop:view']);
    });
  });

  describe('result metadata', () => {
    it('should include policy metadata in result', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-all',
          effect: 'allow',
          conditions: [],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.policy.id).toBe('test-policy');
      expect(result.policy.version).toBe(1);
      expect(result.policy.hash).toBe('testhash123');
    });

    it('should include evaluation timestamp', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-all',
          effect: 'allow',
          conditions: [],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const before = new Date();
      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);
      const after = new Date();

      expect(result.evaluatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.evaluatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include duration in milliseconds', () => {
      const policy = createTestPolicy([
        {
          id: 'allow-all',
          effect: 'allow',
          conditions: [],
          actions: ['teleop:control'],
          priority: 1,
        },
      ]);

      const result = evaluator.evaluate(policy, createContext(), ['teleop:control']);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(100); // Should be fast
    });
  });

  describe('performance', () => {
    it('should evaluate 1000 policies in under 50ms p95', () => {
      const policy = createTestPolicy([
        {
          id: 'deny-guests',
          effect: 'deny',
          conditions: [{ field: 'credential.role', operator: 'eq', value: 'guest' }],
          actions: ['teleop:control'],
          priority: 1,
        },
        {
          id: 'allow-operators',
          effect: 'allow',
          conditions: [
            { field: 'credential.role', operator: 'eq', value: 'operator' },
            { field: 'context.resource', operator: 'contains', value: 'robot' },
          ],
          actions: ['teleop:control', 'teleop:view'],
          priority: 2,
        },
        {
          id: 'deny-default',
          effect: 'deny',
          conditions: [],
          actions: ['*'],
          priority: 100,
        },
      ]);

      const ctx = createContext();
      const durations: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const result = evaluator.evaluate(policy, ctx, ['teleop:control']);
        durations.push(result.durationMs);
      }

      durations.sort((a, b) => a - b);
      const p95 = durations[Math.floor(durations.length * 0.95)];

      expect(p95).toBeLessThan(50);
    });
  });
});
