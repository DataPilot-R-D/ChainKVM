/**
 * Policy evaluation engine implementing ABAC semantics.
 * Evaluation order: first-deny wins, then first-allow, default deny.
 */

import type { Policy, PolicyRule } from './types.js';
import type { EvaluationContext, EvaluationResult } from './evaluation-types.js';
import { evaluateCondition } from './condition-evaluator.js';

/** Policy evaluator interface. */
export interface PolicyEvaluator {
  /** Evaluate a policy against context and requested actions. */
  evaluate(
    policy: Policy,
    context: EvaluationContext,
    requestedActions: string[]
  ): EvaluationResult;
}

/** Check if a rule matches the context and actions. */
function matchesRule(
  rule: PolicyRule,
  context: EvaluationContext,
  actions: string[]
): boolean {
  const actionMatch = actions.some((a) => rule.actions.includes(a));
  if (!actionMatch) return false;

  return rule.conditions.every((c) => evaluateCondition(c, context));
}

/** Get intersection of requested actions and rule actions. */
function intersectActions(requested: string[], ruleActions: string[]): string[] {
  return requested.filter((a) => ruleActions.includes(a));
}

/** Create base evaluation result. */
function createResult(
  policy: Policy,
  startTime: number,
  overrides: Partial<EvaluationResult>
): EvaluationResult {
  return {
    decision: 'deny',
    allowedActions: [],
    policy: { id: policy.id, version: policy.version, hash: policy.hash },
    evaluatedAt: new Date(),
    durationMs: performance.now() - startTime,
    ...overrides,
  };
}

/**
 * Create a policy evaluator instance.
 * Implements first-deny-wins, then first-allow, default-deny semantics.
 */
export function createPolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate(
      policy: Policy,
      context: EvaluationContext,
      requestedActions: string[]
    ): EvaluationResult {
      const startTime = performance.now();

      // Sort rules by priority (ascending - lower number = higher priority)
      const sortedRules = [...policy.rules].sort((a, b) => a.priority - b.priority);

      // First pass: check all deny rules (first-deny-wins)
      for (const rule of sortedRules) {
        if (rule.effect === 'deny' && matchesRule(rule, context, requestedActions)) {
          return createResult(policy, startTime, {
            matchedRule: rule.id,
            reason: `denied by rule: ${rule.id}`,
          });
        }
      }

      // Second pass: check all allow rules (first-allow)
      for (const rule of sortedRules) {
        if (rule.effect === 'allow' && matchesRule(rule, context, requestedActions)) {
          return createResult(policy, startTime, {
            decision: 'allow',
            matchedRule: rule.id,
            allowedActions: intersectActions(requestedActions, rule.actions),
          });
        }
      }

      // Default deny
      return createResult(policy, startTime, { reason: 'no matching rule' });
    },
  };
}
