# M2-009: Add DataChannel Message Routing

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a developer, I need the Robot Agent to receive and route DataChannel messages so that control commands reach the appropriate handlers.

## Requirements

### Functional Requirements
- FR-9: Receive control commands via DataChannel
- Route messages to correct handler (drive, kvm, e_stop)
- Support multiple message types

### Non-Functional Requirements
- Message routing overhead < 1ms

## Definition of Done

- [ ] DataChannel listener setup
- [ ] Message deserialization
- [ ] Message type routing
- [ ] Handler registration mechanism
- [ ] Error response formatting
- [ ] Binary message support (optional)
- [ ] Unit tests for routing
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Drive Command Routing
- **Preconditions:** DataChannel open
- **Steps:**
  1. Send drive command message
  2. Verify routed to drive handler
  3. Verify response received
- **Expected Result:** Command processed
- **Pass Criteria:** Drive handler invoked

### Test Case 2: KVM Input Routing
- **Preconditions:** DataChannel open
- **Steps:**
  1. Send keyboard event
  2. Send mouse event
  3. Verify correct routing
- **Expected Result:** KVM handler invoked
- **Pass Criteria:** Events processed correctly

### Test Case 3: Unknown Message Type
- **Preconditions:** DataChannel open
- **Steps:**
  1. Send message with unknown type
  2. Verify error response
- **Expected Result:** Clean error handling
- **Pass Criteria:** Error response, no crash

### Test Case 4: High Message Rate
- **Preconditions:** DataChannel open
- **Steps:**
  1. Send 1000 messages/second
  2. Verify all processed
  3. Check latency
- **Expected Result:** Handles high rate
- **Pass Criteria:** < 1ms routing overhead

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Message loss | M | Acknowledgment for critical messages |
| Serialization errors | M | Strict schema validation |
| Handler bottlenecks | M | Async processing, queue management |

## Dependencies

- **Blocked by:** M2-004, M1-003
- **Blocks:** M6-002
- **Related:** M2-003

## References

- PRD Section: 8.3 (FR-9: Control channel)
- Design Decision: 16.17 (Message Format)

## Open Questions

- JSON vs binary protocol?
- Compression for high-frequency messages?
