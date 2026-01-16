# M1-003: Implement Control API (drive, kvm_input, e_stop)

## Metadata
- **Milestone:** M1 - Robot Agent Video Stream & Local Control
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As an operator, I want to send control commands to the robot so that I can drive, interact via KVM inputs, or trigger emergency stop.

## Requirements

### Functional Requirements
- FR-9: The Robot Agent SHALL accept drive commands (velocity, direction) and KVM inputs (keyboard, mouse events)

### Non-Functional Requirements
- NFR-P2: Control command RTT < 100ms (p95)

## Definition of Done

- [ ] Drive command API implemented (velocity, angular velocity)
- [ ] KVM input API implemented (keyboard events, mouse events)
- [ ] E-Stop API implemented (immediate halt)
- [ ] Command validation and sanitization
- [ ] Command rate limiting hooks
- [ ] Unit tests for all command types
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Drive Command Processing
- **Preconditions:** Robot Agent running, control API active
- **Steps:**
  1. Send drive command (velocity: 0.5 m/s, direction: forward)
  2. Verify command received and parsed
  3. Verify motor control signal generated
- **Expected Result:** Command executed within latency budget
- **Pass Criteria:** Command processed in < 50ms

### Test Case 2: KVM Input Handling
- **Preconditions:** Robot Agent running, KVM interface active
- **Steps:**
  1. Send keyboard event (key: 'A', action: press)
  2. Send mouse event (move: x=100, y=200)
  3. Send mouse event (click: left)
- **Expected Result:** All inputs correctly forwarded
- **Pass Criteria:** Input events match sent commands exactly

### Test Case 3: E-Stop Command
- **Preconditions:** Robot Agent running, movement active
- **Steps:**
  1. Start drive command
  2. Send E-Stop command
  3. Verify immediate halt
- **Expected Result:** All motion stops immediately
- **Pass Criteria:** Motion stopped within 50ms of E-Stop receipt

### Test Case 4: Invalid Command Rejection
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Send malformed command
  2. Send out-of-range values
  3. Send unsupported command type
- **Expected Result:** Commands rejected with appropriate errors
- **Pass Criteria:** No crashes, clear error messages

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Command injection attacks | H | Strict input validation, whitelist commands |
| Latency exceeds requirements | H | Profile critical path, optimize serialization |
| Motor control safety | H | Hardware E-Stop as backup |

## Dependencies

- **Blocked by:** M1-001
- **Blocks:** M2-003, M2-009, M1-006
- **Related:** M1-005, M1-007

## References

- PRD Section: 8.3 (FR-9: Control channel)
- Design Decision: 16.2 (Command Protocol)

## Open Questions

- Command protocol format (JSON, protobuf, custom)?
- Supported motor/KVM hardware for POC?
