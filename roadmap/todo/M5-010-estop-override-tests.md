# M5-010: Add E-Stop Override Tests

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** QA
- **Priority:** P0
- **Status:** Todo

## User Story

As a safety engineer, I want comprehensive E-Stop tests so that I can verify the safety system works under all conditions.

## Requirements

### Functional Requirements
- FR-14: Verify E-Stop triggers safe state within 100ms

### Non-Functional Requirements
- Tests must be deterministic
- Cover all E-Stop paths

## Definition of Done

- [ ] Feature branch created (`feature/M5-010-estop-override-tests`)
- [ ] E-Stop command test
- [ ] E-Stop under load test
- [ ] E-Stop timing verification
- [ ] E-Stop priority test
- [ ] E-Stop recovery test
- [ ] Hardware E-Stop test (if applicable)
- [ ] CI integration
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Basic E-Stop
- **Preconditions:** Robot in motion
- **Steps:**
  1. Send E-Stop command
  2. Verify robot stops
  3. Measure stop time
- **Expected Result:** Immediate stop
- **Pass Criteria:** Stop < 100ms

### Test Case 2: E-Stop Under High Load
- **Preconditions:** 100 commands/second
- **Steps:**
  1. Maintain high command rate
  2. Send E-Stop
  3. Verify prioritized handling
- **Expected Result:** E-Stop processed immediately
- **Pass Criteria:** No delay from load

### Test Case 3: E-Stop During Network Issues
- **Preconditions:** High latency network
- **Steps:**
  1. Introduce 200ms latency
  2. Send E-Stop
  3. Verify processed
- **Expected Result:** E-Stop works
- **Pass Criteria:** Stop despite latency

### Test Case 4: E-Stop Supersedes Other Commands
- **Preconditions:** Command queue with pending commands
- **Steps:**
  1. Queue multiple drive commands
  2. Send E-Stop
  3. Verify E-Stop processed first
- **Expected Result:** E-Stop has priority
- **Pass Criteria:** Pending commands not executed

### Test Case 5: E-Stop Idempotency
- **Preconditions:** Robot operational
- **Steps:**
  1. Send E-Stop
  2. Send E-Stop again
  3. Verify no errors
- **Expected Result:** Idempotent operation
- **Pass Criteria:** No crashes, clean handling

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Test environment safety | H | Simulation or constrained hardware |
| Non-deterministic timing | M | Statistical analysis |
| Incomplete coverage | M | Systematic test design |

## Dependencies

- **Blocked by:** M5-007, M1-006
- **Blocks:** None
- **Related:** M5-011

## References

- PRD Section: 8.5 (FR-14: Safe state)
- Design Decision: 16.6 (Safe State Definition)

## Open Questions

- Hardware-in-loop testing needed?
- Chaos testing for E-Stop?
