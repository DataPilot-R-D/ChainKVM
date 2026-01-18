# M5-007: Implement Safe-State Transition on Trigger

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a Robot Agent, I want to transition to a safe state reliably when triggered so that the robot stops safely under all failure conditions.

## Requirements

### Functional Requirements
- FR-14: Robot SHALL transition to safe state within 100ms when triggered

### Non-Functional Requirements
- Safe state transition < 100ms
- Transition must succeed even under load

## Definition of Done

- [ ] Feature branch created (`feature/M5-007-safe-state-trigger`)
- [ ] Unified trigger interface
- [ ] Priority-based trigger handling
- [ ] Atomic state transition
- [ ] Hardware integration (if applicable)
- [ ] Transition confirmation
- [ ] Recovery procedure
- [ ] Unit tests for all triggers
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: E-Stop Trigger
- **Preconditions:** Robot in motion
- **Steps:**
  1. Send E-Stop command
  2. Measure transition time
- **Expected Result:** Safe state entered
- **Pass Criteria:** Transition < 100ms

### Test Case 2: Channel Loss Trigger
- **Preconditions:** Robot in motion
- **Steps:**
  1. Disconnect control channel
  2. Wait for detection + transition
- **Expected Result:** Safe state entered
- **Pass Criteria:** Transition after detection

### Test Case 3: Invalid Command Trigger
- **Preconditions:** Robot operational
- **Steps:**
  1. Exceed invalid command threshold
  2. Verify safe state
- **Expected Result:** Safe state entered
- **Pass Criteria:** Transition on threshold

### Test Case 4: Revocation Trigger
- **Preconditions:** Active session, robot in motion
- **Steps:**
  1. Revoke session
  2. Verify safe state
- **Expected Result:** Safe state entered
- **Pass Criteria:** Transition after revocation

### Test Case 5: Trigger Under Load
- **Preconditions:** High command rate
- **Steps:**
  1. Send 100 commands/second
  2. Trigger E-Stop
  3. Measure transition time
- **Expected Result:** Still transitions fast
- **Pass Criteria:** Transition < 100ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Transition failure | H | Hardware backup, watchdog |
| Priority inversion | M | Priority-based scheduling |
| Incomplete transition | H | Confirmation and retry |

## Dependencies

- **Blocked by:** M1-006, M5-004, M5-005, M5-006
- **Blocks:** M5-010
- **Related:** M5-008

## References

- PRD Section: 8.5 (FR-14: Safe state)
- Design Decision: 16.6 (Safe State Definition)

## Open Questions

- Hardware watchdog integration?
- Recovery authorization requirements?
