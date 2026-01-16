# M2-007: Implement Session State UI Indicators

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P1
- **Status:** Todo

## User Story

As an operator, I want to see the connection state and session status so that I know when I can safely control the robot.

## Requirements

### Functional Requirements
- Display connection state (connecting, connected, disconnected)
- Display session validity status
- Display permission level

### Non-Functional Requirements
- State updates reflected in UI within 100ms

## Definition of Done

- [ ] Connection state indicator (color-coded)
- [ ] Session timer display
- [ ] Permission badge display
- [ ] Error state messaging
- [ ] State transition animations
- [ ] Screen reader announcements
- [ ] Unit tests for state display
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Connection States
- **Preconditions:** Web Console loaded
- **Steps:**
  1. Observe initial state (disconnected)
  2. Initiate connection
  3. Observe connecting state
  4. Verify connected state
- **Expected Result:** States displayed accurately
- **Pass Criteria:** Correct indicator at each state

### Test Case 2: Session Information
- **Preconditions:** Connected session
- **Steps:**
  1. Check session timer
  2. Verify permission level shown
  3. Check token expiry warning
- **Expected Result:** Accurate session info
- **Pass Criteria:** Timer accurate, permissions correct

### Test Case 3: Disconnection Handling
- **Preconditions:** Connected session
- **Steps:**
  1. Disconnect network
  2. Observe state change
  3. Verify reconnection indicator
- **Expected Result:** Clear disconnection feedback
- **Pass Criteria:** User informed of issue

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| State inconsistency | M | Single source of truth for state |
| Delayed updates | M | Immediate UI update on state change |
| Confusing indicators | M | User testing, clear iconography |

## Dependencies

- **Blocked by:** M2-001, M2-004
- **Blocks:** M5-009
- **Related:** M2-008

## References

- PRD Section: 7.1 (POC scope - Web Console)
- Design Decision: 16.15 (UI State Management)

## Open Questions

- Color scheme for different states?
- Audio alerts for critical state changes?
