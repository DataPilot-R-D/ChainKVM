# M2-003: Implement Control Input Handlers

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P0
- **Status:** Todo

## User Story

As an operator, I want to control the robot using keyboard and mouse so that I can drive and interact naturally.

## Requirements

### Functional Requirements
- FR-9: Capture and send keyboard events
- FR-9: Capture and send mouse events
- Support gamepad input (optional)

### Non-Functional Requirements
- NFR-P2: Input-to-command latency < 10ms locally

## Definition of Done

- [ ] Keyboard event capture (keydown, keyup)
- [ ] Mouse event capture (move, click, scroll)
- [ ] Input debouncing for performance
- [ ] Focus management (capture mode)
- [ ] Input mapping configuration
- [ ] E-Stop keyboard shortcut
- [ ] Unit tests for input handlers
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Keyboard Input
- **Preconditions:** Console connected
- **Steps:**
  1. Focus on control area
  2. Press arrow keys
  3. Verify commands sent
- **Expected Result:** Drive commands generated
- **Pass Criteria:** Commands match key presses

### Test Case 2: Mouse Input
- **Preconditions:** Console connected
- **Steps:**
  1. Move mouse in control area
  2. Click buttons
  3. Scroll wheel
- **Expected Result:** KVM events generated
- **Pass Criteria:** Events match mouse actions

### Test Case 3: E-Stop Shortcut
- **Preconditions:** Console connected
- **Steps:**
  1. Press Ctrl+Shift+Space (E-Stop)
  2. Verify E-Stop sent
- **Expected Result:** Immediate E-Stop command
- **Pass Criteria:** E-Stop processed within 50ms

### Test Case 4: Focus Loss Handling
- **Preconditions:** Input capture active
- **Steps:**
  1. Click outside control area
  2. Verify input capture stops
  3. Click back in area
- **Expected Result:** Safe handling of focus loss
- **Pass Criteria:** No stuck keys, clean resume

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser input limitations | M | Test across browsers, document limitations |
| Input lag | H | Minimize processing, direct DataChannel send |
| Accidental input during focus loss | H | Clear input state on focus loss |

## Dependencies

- **Blocked by:** M2-001, M1-003
- **Blocks:** M2-009
- **Related:** M2-004

## References

- PRD Section: 8.3 (FR-9: Control channel)
- Design Decision: 16.11 (Input Mapping)

## Open Questions

- Customizable key bindings for POC?
- Touch screen support needed?
