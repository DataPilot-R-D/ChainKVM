# M2-006: Implement Signaling Endpoint

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a system component, I need a signaling service so that WebRTC peers can exchange connection information securely.

## Requirements

### Functional Requirements
- FR-8, FR-9: Provide WebSocket-based signaling to support video streaming and control channel establishment
- Exchange SDP offers and answers
- Relay ICE candidates

### Non-Functional Requirements
- Signaling latency < 100ms per message

## Definition of Done

- [ ] WebSocket server endpoint
- [ ] Room/session management
- [ ] SDP offer/answer relay
- [ ] ICE candidate relay
- [ ] Authentication integration
- [ ] Message validation
- [ ] Connection cleanup
- [ ] Unit tests for signaling
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Signaling Connection
- **Preconditions:** Signaling server running
- **Steps:**
  1. Connect WebSocket from Web Console
  2. Authenticate with token
  3. Verify connection accepted
- **Expected Result:** WebSocket established
- **Pass Criteria:** Connection in < 500ms

### Test Case 2: SDP Exchange
- **Preconditions:** Both peers connected to signaling
- **Steps:**
  1. Send SDP offer from Console
  2. Verify Robot Agent receives offer
  3. Send SDP answer back
  4. Verify Console receives answer
- **Expected Result:** Bidirectional SDP exchange
- **Pass Criteria:** Messages delivered in < 100ms

### Test Case 3: ICE Candidate Relay
- **Preconditions:** Signaling connected
- **Steps:**
  1. Send ICE candidates as gathered
  2. Verify delivery to peer
- **Expected Result:** All candidates relayed
- **Pass Criteria:** No candidate loss

### Test Case 4: Unauthorized Access
- **Preconditions:** Signaling server running
- **Steps:**
  1. Connect without authentication
  2. Attempt to join session
- **Expected Result:** Connection rejected
- **Pass Criteria:** Clear authentication error

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Signaling server bottleneck | M | Horizontal scaling capability |
| Message tampering | H | Authenticate all messages |
| DoS attacks | M | Rate limiting, connection limits |

## Dependencies

- **Blocked by:** M3-001 (Gateway architecture)
- **Blocks:** M2-004, M3-009
- **Related:** M3-006

## References

- PRD Section: 8.3 (Media + control transport - FR-8, FR-9)
- Design Decision: 16.14 (Signaling Protocol)

## Open Questions

- JSON-based or binary protocol?
- Session persistence across reconnects?
