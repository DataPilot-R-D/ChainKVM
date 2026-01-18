# M3-012: Build Policy Evaluation Test Suite

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** QA
- **Priority:** P1
- **Status:** Todo

## User Story

As a QA engineer, I want comprehensive tests for policy evaluation so that access control logic is verified correct.

## Requirements

### Functional Requirements
- Test all policy rule types
- Test edge cases and boundary conditions
- Test policy conflicts

### Non-Functional Requirements
- Test suite runs in < 2 minutes
- 100% coverage of policy code paths

## Definition of Done

- [ ] Feature branch created (`feature/M3-012-policy-evaluation-tests`)
- [ ] Unit tests for rule parsing
- [ ] Unit tests for context building
- [ ] Integration tests for evaluation
- [ ] Negative tests (deny scenarios)
- [ ] Performance tests
- [ ] Policy conflict tests
- [ ] CI integration
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Test Suite Coverage
- **Preconditions:** Policy engine complete
- **Steps:**
  1. Run test suite
  2. Check coverage report
- **Expected Result:** High coverage
- **Pass Criteria:** > 90% code coverage

### Test Case 2: Regression Detection
- **Preconditions:** Test suite passing
- **Steps:**
  1. Introduce bug in evaluation logic
  2. Run test suite
- **Expected Result:** Bug detected
- **Pass Criteria:** Test fails appropriately

### Test Case 3: Edge Case Coverage
- **Preconditions:** Test suite complete
- **Steps:**
  1. Review edge cases documented
  2. Verify tests exist for each
- **Expected Result:** All edges covered
- **Pass Criteria:** No undocumented behaviors

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Incomplete test scenarios | M | Security review of test cases |
| Flaky tests | M | Deterministic test design |
| Maintenance burden | L | Clear test organization |

## Dependencies

- **Blocked by:** M3-005
- **Blocks:** None
- **Related:** M3-013

## References

- PRD Section: 8.2 (Policy & authorization)
- Design Decision: 16.30 (Test Strategy)

## Open Questions

- Property-based testing for policies?
- Fuzzing for policy parser?
