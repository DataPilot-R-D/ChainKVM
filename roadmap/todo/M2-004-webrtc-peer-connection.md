# M2-004: Implement WebRTC Peer Connection Setup

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P0
- **Status:** Todo

## User Story

As an operator, I want a reliable peer-to-peer connection to the robot so that I can receive video and send commands with minimal latency.

## Requirements

### Functional Requirements
- FR-8: Establish WebRTC connection for video
- FR-9: Establish DataChannel for commands

### Non-Functional Requirements
- NFR-P1: Connection setup < 3 seconds

## Definition of Done

- [ ] RTCPeerConnection initialization
- [ ] SDP offer/answer exchange
- [ ] ICE candidate gathering
- [ ] Video track setup
- [ ] DataChannel creation (reliable + unreliable)
- [ ] Connection state management
- [ ] Reconnection logic
- [ ] Unit tests for connection flow
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Connection Establishment
- **Preconditions:** Signaling server available
- **Steps:**
  1. Initiate connection request
  2. Complete signaling handshake
  3. Wait for connection established
- **Expected Result:** Peer connection established
- **Pass Criteria:** Connection in < 3 seconds

### Test Case 2: Video Track Reception
- **Preconditions:** Peer connection established
- **Steps:**
  1. Wait for remote video track
  2. Attach to video element
  3. Verify playback
- **Expected Result:** Video playing
- **Pass Criteria:** Video renders correctly

### Test Case 3: DataChannel Open
- **Preconditions:** Peer connection established
- **Steps:**
  1. Create DataChannel for commands
  2. Wait for channel open
  3. Send test message
- **Expected Result:** Bidirectional communication
- **Pass Criteria:** Message received and echoed

### Test Case 4: Reconnection
- **Preconditions:** Connection established
- **Steps:**
  1. Simulate network disruption
  2. Wait for reconnection attempt
  3. Verify recovery
- **Expected Result:** Automatic reconnection
- **Pass Criteria:** Reconnected within 5 seconds

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| NAT traversal failures | H | Proper STUN/TURN configuration |
| Connection instability | M | Implement reconnection logic |
| Browser WebRTC differences | M | Test across browsers, use adapter.js |

## Dependencies

- **Blocked by:** M2-006, M1-002
- **Blocks:** M2-002, M2-009, M5-003
- **Related:** M2-005

## References

- PRD Section: 8.3 (FR-8, FR-9: Transport)
- Design Decision: 16.12 (WebRTC Configuration)

## Open Questions

- Simulcast for adaptive quality?
- Multiple DataChannels (reliable + unreliable)?
