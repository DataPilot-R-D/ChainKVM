/**
 * In-memory policy store implementation.
 */

import { createHash } from 'node:crypto';
import type {
  Policy,
  PolicyRule,
  PolicyStore,
  PolicyStoreConfig,
  CreatePolicyInput,
  UpdatePolicyInput,
} from './types.js';
import { PolicyError } from './errors.js';

const DEFAULT_MAX_POLICIES = 10000;

/** Compute SHA-256 hash of policy rules. */
function computeRulesHash(rules: PolicyRule[]): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(rules));
  return hash.digest('hex');
}

/**
 * Create an in-memory policy store.
 */
export function createPolicyStore(config: PolicyStoreConfig = {}): PolicyStore {
  const maxPolicies = config.maxPolicies ?? DEFAULT_MAX_POLICIES;
  const policies = new Map<string, Policy>();
  const history = new Map<string, Policy[]>();

  return {
    get(id: string): Policy | undefined {
      return policies.get(id);
    },

    getByVersion(id: string, version: number): Policy | undefined {
      const versions = history.get(id);
      if (!versions) return undefined;
      return versions.find((p) => p.version === version);
    },

    list(): Policy[] {
      return Array.from(policies.values());
    },

    create(input: CreatePolicyInput): Policy {
      if (policies.has(input.id)) {
        throw PolicyError.alreadyExists(input.id);
      }
      if (policies.size >= maxPolicies) {
        throw PolicyError.maxPoliciesExceeded(maxPolicies);
      }

      const now = new Date();
      const policy: Policy = {
        id: input.id,
        version: 1,
        name: input.name,
        description: input.description,
        rules: input.rules,
        createdAt: now,
        updatedAt: now,
        hash: computeRulesHash(input.rules),
      };

      policies.set(input.id, policy);
      history.set(input.id, [policy]);
      return policy;
    },

    update(id: string, updates: UpdatePolicyInput): Policy {
      const existing = policies.get(id);
      if (!existing) {
        throw PolicyError.notFound(id);
      }

      const now = new Date();
      const newRules = updates.rules ?? existing.rules;
      const updated: Policy = {
        ...existing,
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        rules: newRules,
        version: existing.version + 1,
        updatedAt: now,
        hash: computeRulesHash(newRules),
      };

      policies.set(id, updated);
      const versions = history.get(id) ?? [];
      versions.push(updated);
      history.set(id, versions);

      return updated;
    },

    delete(id: string): boolean {
      const existed = policies.has(id);
      policies.delete(id);
      history.delete(id);
      return existed;
    },

    getVersionHistory(id: string): Policy[] {
      return history.get(id) ?? [];
    },

    computeHash(rules: PolicyRule[]): string {
      return computeRulesHash(rules);
    },

    clear(): void {
      policies.clear();
      history.clear();
    },
  };
}
