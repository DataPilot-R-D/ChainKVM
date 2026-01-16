# M5-003: Implement Session Teardown (WebRTC Close)

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want WebRTC sessions closed on revocation so that revoked operators lose media and control access immediately.

## Requirements

### Functional Requirements
- FR-7: Gateway terminates active sessions on revocation

### Non-Functional Requirements
- Session teardown < 500ms after revocation

## Definition of Done

- [ ] Signaling server session termination
- [ ] WebRTC connection close trigger
- [ ] ICE connection termination
- [ ] Resource cleanup
- [ ] Operator notification (connection closed)
- [ ] Teardown audit event
- [ ] Unit tests for teardown
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Clean Session Teardown
- **Preconditions:** Active WebRTC session
- **Steps:**
  1. Trigger revocation
  2. Observe WebRTC connection state
  3. Verify video/control stops
- **Expected Result:** Session terminated
- **Pass Criteria:** Connection closed within 500ms

### Test Case 2: Multiple Stream Teardown
- **Preconditions:** Session with video + data channels
- **Steps:**
  1. Trigger revocation
  2. Verify all streams closed
- **Expected Result:** All media stopped
- **Pass Criteria:** No residual streams

### Test Case 3: Operator Notification
- **Preconditions:** Active session, operator connected
- **Steps:**
  1. Trigger revocation
  2. Check operator receives notification
- **Expected Result:** Operator informed
- **Pass Criteria:** Disconnect reason shown

### Test Case 4: Resource Cleanup
- **Preconditions:** Session teardown triggered
- **Steps:**
  1. Teardown session
  2. Check for resource leaks
- **Expected Result:** Clean cleanup
- **Pass Criteria:** No orphaned resources

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Incomplete teardown | H | Thorough resource tracking |
| Teardown race conditions | M | Atomic state transitions |
| Network delays | M | Timeout-based cleanup |

## Dependencies

- **Blocked by:** M5-001, M5-002, M2-004
- **Blocks:** M5-004
- **Related:** M3-009, M5-009

## References

- PRD Section: 8.2 (FR-7: Revocation)
- Design Decision: 16.27 (Integration Architecture)

## Open Questions

- Graceful vs immediate disconnect?
- Reconnection prevention mechanism?
