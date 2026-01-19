# M5-011: Build Revocation Scenario Test Suite

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** QA
- **Priority:** P1
- **Status:** Todo

## User Story

As a QA engineer, I want comprehensive revocation tests so that I can verify all revocation scenarios work correctly.

## Requirements

### Functional Requirements
- FR-7: Verify revocation terminates sessions
- Test all revocation paths

### Non-Functional Requirements
- Test suite runs in < 10 minutes
- Cover edge cases

## Definition of Done

- [ ] Feature branch created (`feature/M5-011-revocation-scenario-tests`)
- [ ] Admin revocation test
- [ ] Token expiry test
- [ ] Manual session end test
- [ ] Bulk revocation test
- [ ] Revocation during activity test
- [ ] Revocation recovery test
- [ ] Concurrent revocation test
- [ ] CI integration
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Full Revocation Flow
- **Preconditions:** Active session
- **Steps:**
  1. Admin triggers revocation
  2. Verify Gateway processes
  3. Verify session terminated
  4. Verify Robot Agent notified
  5. Verify safe state entered
  6. Verify audit logged
- **Expected Result:** Complete flow works
- **Pass Criteria:** All steps successful

### Test Case 2: Revocation During Command
- **Preconditions:** Session active, command in flight
- **Steps:**
  1. Send drive command
  2. Immediately revoke
  3. Verify command handling
- **Expected Result:** Clean termination
- **Pass Criteria:** No partial command execution

### Test Case 3: Double Revocation
- **Preconditions:** Session being revoked
- **Steps:**
  1. Trigger revocation
  2. Trigger revocation again
- **Expected Result:** Idempotent handling
- **Pass Criteria:** No errors, single audit event

### Test Case 4: Revocation of Expired Session
- **Preconditions:** Session already expired
- **Steps:**
  1. Wait for session expiry
  2. Attempt revocation
- **Expected Result:** Handled gracefully
- **Pass Criteria:** Appropriate response

### Test Case 5: Network Partition During Revocation
- **Preconditions:** Active session
- **Steps:**
  1. Partition network
  2. Trigger revocation
  3. Verify eventual consistency
- **Expected Result:** Revocation completes
- **Pass Criteria:** Session terminated after partition heals

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Race condition coverage | M | Systematic concurrency testing |
| Environment complexity | M | Containerized test env |
| Flaky tests | M | Deterministic test design |

## Dependencies

- **Blocked by:** M5-001, M5-003, M5-004
- **Blocks:** None
- **Related:** M5-010

## References

- PRD Section: 8.2 (FR-7: Revocation)
- Design Decision: 16.26 (Revocation Strategy)

## Open Questions

- Chaos testing for revocation?
- Long-running session tests?
