# M1-006: Implement Safe-State Transitions & E-Stop

## Metadata
- **Milestone:** M1 - Robot Agent Video Stream & Local Control
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a safety engineer, I want the Robot Agent to transition to a safe state when triggered so that the robot cannot cause harm during failures or emergencies.

## Requirements

### Functional Requirements
- FR-14: The Robot Agent SHALL transition to a safe state (stop all motion) within 100ms when triggered by E-Stop, control channel loss, or repeated invalid commands

### Non-Functional Requirements
- Safe state transition must complete within 100ms

## Definition of Done

- [ ] Safe state defined (all motors stopped, brakes engaged)
- [ ] E-Stop trigger implemented
- [ ] Control channel loss detection
- [ ] State machine for transitions
- [ ] Hardware E-Stop integration (if applicable)
- [ ] Recovery from safe state procedure
- [ ] Unit tests for all triggers
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Manual E-Stop
- **Preconditions:** Robot in motion
- **Steps:**
  1. Send E-Stop command
  2. Measure time to full stop
- **Expected Result:** Robot stops
- **Pass Criteria:** Stop completed within 100ms

### Test Case 2: Control Channel Loss
- **Preconditions:** Robot in motion, WebRTC connected
- **Steps:**
  1. Disconnect WebRTC channel
  2. Wait for detection timeout
  3. Verify safe state entered
- **Expected Result:** Robot enters safe state automatically
- **Pass Criteria:** Safe state within 2 seconds of disconnect

### Test Case 3: Repeated Invalid Commands
- **Preconditions:** Robot operational
- **Steps:**
  1. Send 5 invalid commands in 1 second
  2. Verify safe state trigger
- **Expected Result:** Safe state entered, session flagged
- **Pass Criteria:** Safe state after threshold exceeded

### Test Case 4: Recovery from Safe State
- **Preconditions:** Robot in safe state
- **Steps:**
  1. Clear trigger condition
  2. Initiate recovery sequence
  3. Resume normal operation
- **Expected Result:** Normal operation restored
- **Pass Criteria:** Recovery within 5 seconds, audit logged

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Safe state not safe enough | H | Hardware E-Stop backup, fail-safe design |
| False positive triggers | M | Tune thresholds, add hysteresis |
| Recovery enables unsafe state | H | Require explicit operator confirmation |

## Dependencies

- **Blocked by:** M1-001, M1-003
- **Blocks:** M5-005, M5-007
- **Related:** M5-004, M5-010

## References

- PRD Section: 8.5 (FR-14: Local safety override)
- Design Decision: 16.6 (Safe State Definition)

## Open Questions

- Hardware E-Stop integration for POC?
- Safe state recovery authorization requirements?
