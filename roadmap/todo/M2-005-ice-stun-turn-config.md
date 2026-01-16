# M2-005: Implement ICE/STUN/TURN Configuration

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P1
- **Status:** Todo

## User Story

As an operator, I want the system to handle NAT traversal automatically so that I can connect from any network.

## Requirements

### Functional Requirements
- FR-10: Configure ICE servers for NAT traversal
- Support STUN for direct connectivity
- Support TURN for relay fallback

### Non-Functional Requirements
- Connection should succeed across typical NAT configurations

## Definition of Done

- [ ] STUN server configuration
- [ ] TURN server configuration
- [ ] ICE candidate gathering optimization
- [ ] Trickle ICE support
- [ ] Fallback to TURN when direct fails
- [ ] ICE restart capability
- [ ] Connection diagnostics logging
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Direct Connection (Same LAN)
- **Preconditions:** Both peers on same network
- **Steps:**
  1. Initiate connection
  2. Observe ICE candidates
  3. Verify direct path used
- **Expected Result:** Host candidate selected
- **Pass Criteria:** Connection via host candidate

### Test Case 2: STUN Connection (Different NATs)
- **Preconditions:** Peers behind different NATs
- **Steps:**
  1. Initiate connection
  2. Observe STUN resolution
  3. Verify connection
- **Expected Result:** Server reflexive candidates used
- **Pass Criteria:** Connection established

### Test Case 3: TURN Fallback
- **Preconditions:** Symmetric NAT blocking direct connection
- **Steps:**
  1. Initiate connection
  2. Wait for TURN fallback
  3. Verify relayed connection
- **Expected Result:** Relay candidate used
- **Pass Criteria:** Connection via TURN server

### Test Case 4: ICE Restart
- **Preconditions:** Connection established
- **Steps:**
  1. Simulate network change (IP change)
  2. Trigger ICE restart
  3. Verify connection recovery
- **Expected Result:** Connection re-established
- **Pass Criteria:** Recovery without full reconnection

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| TURN server costs | M | Budget for bandwidth, optimize usage |
| TURN server availability | H | Multiple TURN servers, failover |
| Complex NAT configurations | M | Extensive testing across NAT types |

## Dependencies

- **Blocked by:** M2-004
- **Blocks:** M6-010
- **Related:** M2-006

## References

- PRD Section: 8.3 (FR-10: NAT traversal)
- Design Decision: 16.13 (ICE Server Selection)

## Open Questions

- Self-hosted vs cloud TURN servers?
- Geographic distribution of TURN servers?
