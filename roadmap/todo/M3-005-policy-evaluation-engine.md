# M3-005: Implement Policy Evaluation Engine

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want policies evaluated against operator credentials so that access decisions are made consistently and correctly.

## Requirements

### Functional Requirements
- FR-4: The Gateway SHALL evaluate policies against presented VCs and current context

### Non-Functional Requirements
- Policy evaluation < 50ms (p95)

## Definition of Done

- [ ] Policy language parser (ABAC rules)
- [ ] Context builder (time, location, resource)
- [ ] Evaluation engine implementation
- [ ] Allow/deny decision output
- [ ] Evaluation audit logging
- [ ] Caching for repeated evaluations
- [ ] Unit tests for evaluation logic
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Simple Policy Evaluation
- **Preconditions:** Policy: "operators with role=admin can access all"
- **Steps:**
  1. Present VC with role=admin
  2. Evaluate access to resource
- **Expected Result:** Access granted
- **Pass Criteria:** Decision = allow

### Test Case 2: Conditional Policy
- **Preconditions:** Policy: "access only during business hours"
- **Steps:**
  1. Evaluate during business hours
  2. Evaluate outside business hours
- **Expected Result:** Correct decisions based on time
- **Pass Criteria:** Allow during hours, deny outside

### Test Case 3: Missing Credential
- **Preconditions:** Policy requires specific credential
- **Steps:**
  1. Present VC without required claim
  2. Evaluate access
- **Expected Result:** Access denied
- **Pass Criteria:** Decision = deny with reason

### Test Case 4: Evaluation Performance
- **Preconditions:** Complex policy set
- **Steps:**
  1. Evaluate 1000 requests
  2. Measure p95 latency
- **Expected Result:** Fast evaluation
- **Pass Criteria:** p95 < 50ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Policy language complexity | M | Keep language simple for POC |
| Evaluation errors | H | Comprehensive testing, audit logging |
| Performance issues | M | Caching, optimization |

## Dependencies

- **Blocked by:** M3-001, M3-002, M3-003, M3-004
- **Blocks:** M3-006, M3-012
- **Related:** M4-006

## References

- PRD Section: 8.2 (FR-4: Local policy)
- Design Decision: 16.23 (Policy Language)

## Open Questions

- Policy language (Open Policy Agent, custom DSL)?
- How to handle policy conflicts?
