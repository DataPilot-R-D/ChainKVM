# M5-005: Implement Control-Channel-Loss Detection

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a Robot Agent, I want to detect control channel loss so that I can enter a safe state when the operator loses connectivity.

## Requirements

### Functional Requirements
- FR-14: Robot must enter safe state on control channel loss beyond threshold

### Non-Functional Requirements
- Detection within 2 seconds of channel loss
- No false positives under normal jitter

## Definition of Done

- [ ] Feature branch created (`feature/M5-005-control-channel-loss-detection`)
- [ ] Heartbeat mechanism implementation
- [ ] Configurable timeout threshold
- [ ] Channel state monitoring
- [ ] Loss detection callback
- [ ] False positive prevention (jitter tolerance)
- [ ] Reconnection handling
- [ ] Unit tests for detection
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Channel Loss Detection
- **Preconditions:** Active control channel
- **Steps:**
  1. Disconnect network abruptly
  2. Wait for detection timeout
  3. Verify loss detected
- **Expected Result:** Loss detected
- **Pass Criteria:** Detection within timeout threshold

### Test Case 2: Safe State Trigger
- **Preconditions:** Robot in motion
- **Steps:**
  1. Disconnect control channel
  2. Wait for detection
  3. Verify safe state entered
- **Expected Result:** Robot stops
- **Pass Criteria:** Safe state after threshold

### Test Case 3: Normal Jitter Handling
- **Preconditions:** Active channel with 100ms jitter
- **Steps:**
  1. Introduce network jitter
  2. Verify no false detection
- **Expected Result:** No false positives
- **Pass Criteria:** Channel remains "connected"

### Test Case 4: Reconnection After Loss
- **Preconditions:** Channel loss detected
- **Steps:**
  1. Restore network
  2. Reconnect channel
  3. Verify recovery
- **Expected Result:** Clean reconnection
- **Pass Criteria:** Normal operation resumes

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positives | H | Tunable threshold, hysteresis |
| Delayed detection | H | Multiple heartbeat paths |
| Reconnection loops | M | Backoff strategy |

## Dependencies

- **Blocked by:** M2-009, M1-006
- **Blocks:** M5-007
- **Related:** M5-006

## References

- PRD Section: 8.5 (FR-14: Local safety)
- Design Decision: 16.6 (Safe State Definition)

## Open Questions

- Heartbeat interval for POC?
- Timeout threshold (2s suggested)?
