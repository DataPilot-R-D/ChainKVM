import { describe, it, expect, beforeEach } from 'vitest';
import { createPolicyStore } from '../policy-store.js';
import { PolicyError, PolicyErrorCode } from '../errors.js';
import type { PolicyStore, PolicyRule, CreatePolicyInput } from '../types.js';

const createTestRule = (id: string): PolicyRule => ({
  id,
  effect: 'allow',
  conditions: [{ field: 'credential.role', operator: 'eq', value: 'operator' }],
  actions: ['teleop:view', 'teleop:control'],
  priority: 1,
});

const createTestPolicy = (id: string, name: string): CreatePolicyInput => ({
  id,
  name,
  description: `Test policy ${id}`,
  rules: [createTestRule('rule-1')],
});

describe('createPolicyStore', () => {
  let store: PolicyStore;

  beforeEach(() => {
    store = createPolicyStore();
  });

  describe('create', () => {
    it('should create a policy with version 1 and hash', () => {
      const input = createTestPolicy('policy-1', 'Test Policy');
      const policy = store.create(input);

      expect(policy.id).toBe('policy-1');
      expect(policy.name).toBe('Test Policy');
      expect(policy.version).toBe(1);
      expect(policy.hash).toBeDefined();
      expect(policy.hash.length).toBe(64); // SHA-256 hex
      expect(policy.createdAt).toBeInstanceOf(Date);
      expect(policy.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw ALREADY_EXISTS for duplicate ID', () => {
      store.create(createTestPolicy('policy-1', 'First'));

      expect(() => store.create(createTestPolicy('policy-1', 'Second'))).toThrow(
        PolicyError
      );
      expect(() => store.create(createTestPolicy('policy-1', 'Second'))).toThrow(
        expect.objectContaining({ code: PolicyErrorCode.ALREADY_EXISTS })
      );
    });

    it('should throw MAX_POLICIES_EXCEEDED when limit reached', () => {
      const limitedStore = createPolicyStore({ maxPolicies: 2 });
      limitedStore.create(createTestPolicy('p1', 'Policy 1'));
      limitedStore.create(createTestPolicy('p2', 'Policy 2'));

      expect(() => limitedStore.create(createTestPolicy('p3', 'Policy 3'))).toThrow(
        expect.objectContaining({ code: PolicyErrorCode.MAX_POLICIES_EXCEEDED })
      );
    });
  });

  describe('get', () => {
    it('should return policy by ID', () => {
      store.create(createTestPolicy('policy-1', 'Test'));

      const policy = store.get('policy-1');

      expect(policy).toBeDefined();
      expect(policy?.id).toBe('policy-1');
    });

    it('should return undefined for non-existent policy', () => {
      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should increment version and update hash', () => {
      store.create(createTestPolicy('policy-1', 'Original'));
      const original = store.get('policy-1')!;

      const updated = store.update('policy-1', {
        name: 'Updated',
        rules: [createTestRule('new-rule')],
      });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe('Updated');
      expect(updated.hash).not.toBe(original.hash);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        original.updatedAt.getTime()
      );
    });

    it('should throw NOT_FOUND for non-existent policy', () => {
      expect(() => store.update('non-existent', { name: 'Test' })).toThrow(
        expect.objectContaining({ code: PolicyErrorCode.NOT_FOUND })
      );
    });

    it('should preserve unchanged fields', () => {
      store.create(createTestPolicy('policy-1', 'Original'));

      const updated = store.update('policy-1', { name: 'New Name' });

      expect(updated.description).toBe('Test policy policy-1');
      expect(updated.rules).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should remove policy from store', () => {
      store.create(createTestPolicy('policy-1', 'Test'));

      const deleted = store.delete('policy-1');

      expect(deleted).toBe(true);
      expect(store.get('policy-1')).toBeUndefined();
    });

    it('should return false for non-existent policy', () => {
      expect(store.delete('non-existent')).toBe(false);
    });
  });

  describe('list', () => {
    it('should return all policies', () => {
      store.create(createTestPolicy('p1', 'Policy 1'));
      store.create(createTestPolicy('p2', 'Policy 2'));

      const policies = store.list();

      expect(policies).toHaveLength(2);
      expect(policies.map((p) => p.id)).toContain('p1');
      expect(policies.map((p) => p.id)).toContain('p2');
    });

    it('should return empty array when no policies', () => {
      expect(store.list()).toEqual([]);
    });
  });

  describe('getVersionHistory', () => {
    it('should return all versions of a policy', () => {
      store.create(createTestPolicy('policy-1', 'V1'));
      store.update('policy-1', { name: 'V2' });
      store.update('policy-1', { name: 'V3' });

      const history = store.getVersionHistory('policy-1');

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[2].version).toBe(3);
    });

    it('should return empty array for non-existent policy', () => {
      expect(store.getVersionHistory('non-existent')).toEqual([]);
    });
  });

  describe('getByVersion', () => {
    it('should return specific version of policy', () => {
      store.create(createTestPolicy('policy-1', 'V1'));
      store.update('policy-1', { name: 'V2' });

      const v1 = store.getByVersion('policy-1', 1);
      const v2 = store.getByVersion('policy-1', 2);

      expect(v1?.name).toBe('V1');
      expect(v2?.name).toBe('V2');
    });

    it('should return undefined for non-existent version', () => {
      store.create(createTestPolicy('policy-1', 'Test'));

      expect(store.getByVersion('policy-1', 99)).toBeUndefined();
    });
  });

  describe('computeHash', () => {
    it('should compute consistent hash for same rules', () => {
      const rules = [createTestRule('rule-1')];

      const hash1 = store.computeHash(rules);
      const hash2 = store.computeHash(rules);

      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different rules', () => {
      const hash1 = store.computeHash([createTestRule('rule-1')]);
      const hash2 = store.computeHash([createTestRule('rule-2')]);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('performance', () => {
    it('should retrieve policy in under 5ms with 1000 policies', () => {
      for (let i = 0; i < 1000; i++) {
        store.create(createTestPolicy(`policy-${i}`, `Policy ${i}`));
      }

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        store.get(`policy-${Math.floor(Math.random() * 1000)}`);
      }
      const elapsed = performance.now() - start;

      expect(elapsed / 100).toBeLessThan(5); // Average < 5ms
    });
  });
});
