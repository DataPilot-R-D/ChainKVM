# M5-009: Implement Operator UI Revocation Notification

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Web Console
- **Priority:** P1
- **Status:** Todo

## User Story

As an operator, I want clear notification when my session is revoked so that I understand why control was lost.

## Requirements

### Functional Requirements
- Display revocation notification
- Show revocation reason
- Prevent confusion with network issues

### Non-Functional Requirements
- Notification displayed < 1 second after session close

## Definition of Done

- [ ] Feature branch created (`feature/M5-009-operator-ui-revocation-notification`)
- [ ] Revocation event listener
- [ ] Notification UI component
- [ ] Revocation reason display
- [ ] Distinction from network error
- [ ] Session recovery prevention
- [ ] Notification styling/UX
- [ ] Unit tests for notification
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Revocation Notification Display
- **Preconditions:** Active session
- **Steps:**
  1. Admin revokes session
  2. Observe operator UI
- **Expected Result:** Notification shown
- **Pass Criteria:** Clear revocation message

### Test Case 2: Reason Display
- **Preconditions:** Session revoked with reason
- **Steps:**
  1. Revoke with reason "Policy violation"
  2. Check notification content
- **Expected Result:** Reason displayed
- **Pass Criteria:** Reason visible to operator

### Test Case 3: Distinction from Network Error
- **Preconditions:** Operator connected
- **Steps:**
  1. Simulate network disconnect
  2. Verify shows "Connection lost"
  3. Trigger revocation
  4. Verify shows "Session revoked"
- **Expected Result:** Different messages
- **Pass Criteria:** Clear distinction

### Test Case 4: Reconnection Prevention
- **Preconditions:** Session revoked
- **Steps:**
  1. Attempt to reconnect
  2. Verify blocked
- **Expected Result:** Reconnection denied
- **Pass Criteria:** Clear "access denied" message

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Missed notification | M | Persistent display |
| Confusing messaging | M | User testing |
| Notification timing | L | Immediate display |

## Dependencies

- **Blocked by:** M5-003, M2-007
- **Blocks:** None
- **Related:** M5-011

## References

- PRD Section: 7.1 (POC scope - Web Console)
- Design Decision: 16.15 (UI State Management)

## Open Questions

- Sound/visual alert?
- Notification persistence duration?
