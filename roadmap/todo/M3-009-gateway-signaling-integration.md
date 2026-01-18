# M3-009: Integrate Gateway with Signaling Service

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P1
- **Status:** Todo

## User Story

As a system integrator, I want the Gateway and Signaling service to work together so that only authorized operators can establish WebRTC connections.

## Requirements

### Functional Requirements
- Signaling requires valid capability token
- Session creation triggers policy check
- Revocation triggers session termination

### Non-Functional Requirements
- Integration overhead < 50ms per connection

## Definition of Done

- [ ] Feature branch created (`feature/M3-009-gateway-signaling-integration`)
- [ ] Signaling authentication via tokens
- [ ] Pre-connection policy check
- [ ] Session-token binding
- [ ] Revocation listener in signaling
- [ ] Integration tests
- [ ] Error handling for auth failures
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Authorized Connection
- **Preconditions:** Valid capability token
- **Steps:**
  1. Connect to signaling with token
  2. Initiate WebRTC session
- **Expected Result:** Connection established
- **Pass Criteria:** Session created successfully

### Test Case 2: Unauthorized Connection
- **Preconditions:** Invalid or missing token
- **Steps:**
  1. Attempt signaling connection
- **Expected Result:** Connection rejected
- **Pass Criteria:** Authentication error returned

### Test Case 3: Revocation During Session
- **Preconditions:** Active session
- **Steps:**
  1. Revoke token at Gateway
  2. Verify signaling terminates session
- **Expected Result:** Session terminated
- **Pass Criteria:** WebRTC connection closed

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Integration complexity | M | Clear interface contracts |
| Latency impact | M | Optimize critical path |
| Error handling gaps | M | Comprehensive error scenarios |

## Dependencies

- **Blocked by:** M3-006, M2-006
- **Blocks:** M5-003
- **Related:** M3-008

## References

- PRD Section: 8.3 (FR-8, FR-9: Transport)
- Design Decision: 16.27 (Integration Architecture)

## Open Questions

- Embedded or separate signaling service?
- Session state synchronization approach?
