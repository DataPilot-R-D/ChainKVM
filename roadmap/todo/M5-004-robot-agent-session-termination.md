# M5-004: Implement Robot Agent Session Termination

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a Robot Agent, I want to terminate sessions on revocation notification so that revoked operators cannot continue controlling the robot.

## Requirements

### Functional Requirements
- FR-7: Robot Agent rejects control from revoked sessions

### Non-Functional Requirements
- Termination within 100ms of notification

## Definition of Done

- [ ] Feature branch created (`feature/M5-004-robot-agent-session-termination`)
- [ ] Revocation notification listener
- [ ] Session state invalidation
- [ ] Control command rejection
- [ ] WebRTC connection close (agent side)
- [ ] Safe state transition trigger
- [ ] Termination audit event
- [ ] Unit tests for termination
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Revocation Notification Handling
- **Preconditions:** Active session on Robot Agent
- **Steps:**
  1. Gateway sends revocation notification
  2. Robot Agent receives notification
  3. Verify session invalidated
- **Expected Result:** Session terminated
- **Pass Criteria:** Commands rejected after notification

### Test Case 2: Command Rejection Post-Revocation
- **Preconditions:** Session just revoked
- **Steps:**
  1. Send control command
  2. Verify command rejected
- **Expected Result:** Command fails
- **Pass Criteria:** "session_revoked" error

### Test Case 3: Safe State on Revocation
- **Preconditions:** Robot in motion, session revoked
- **Steps:**
  1. Trigger revocation
  2. Verify safe state entered
- **Expected Result:** Robot stops
- **Pass Criteria:** Safe state within 100ms

### Test Case 4: Multiple Session Handling
- **Preconditions:** Multiple sessions (if supported)
- **Steps:**
  1. Revoke one session
  2. Verify other sessions unaffected
- **Expected Result:** Targeted revocation
- **Pass Criteria:** Only revoked session terminated

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Notification loss | H | Periodic token validation |
| Delayed notification | M | Token TTL as backup |
| State corruption | M | Atomic state transitions |

## Dependencies

- **Blocked by:** M5-003, M3-010
- **Blocks:** M5-007
- **Related:** M5-005, M1-006

## References

- PRD Section: 8.2 (FR-7: Revocation)
- Design Decision: 16.28 (Validation Architecture)

## Open Questions

- Push vs pull for revocation?
- Notification reliability guarantees?
