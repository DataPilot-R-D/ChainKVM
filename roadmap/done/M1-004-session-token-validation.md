# M1-004: Implement Session Token Validation (Local)

## Metadata
- **Milestone:** M1 - Robot Agent Video Stream & Local Control
- **Component:** Robot Agent
- **Priority:** P1
- **Status:** Todo

## User Story

As a security administrator, I want the Robot Agent to validate session tokens locally so that only authorized operators can control the robot.

## Requirements

### Functional Requirements
- FR-6: The Robot Agent SHALL validate capability tokens before accepting any control command

### Non-Functional Requirements
- Token validation should add < 5ms to command processing

## Definition of Done

- [ ] Token parsing implemented
- [ ] Signature verification implemented
- [ ] Expiry checking implemented
- [ ] Capability scope validation
- [ ] Token caching for performance
- [ ] Unit tests for validation logic
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Valid Token Acceptance
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Generate valid capability token
  2. Send command with token attached
  3. Verify command accepted
- **Expected Result:** Command processed normally
- **Pass Criteria:** No rejection, validation < 5ms

### Test Case 2: Expired Token Rejection
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Generate token with past expiry
  2. Send command with expired token
- **Expected Result:** Command rejected
- **Pass Criteria:** Rejection with "token_expired" error

### Test Case 3: Invalid Signature Rejection
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Create token with tampered signature
  2. Send command with invalid token
- **Expected Result:** Command rejected
- **Pass Criteria:** Rejection with "invalid_signature" error

### Test Case 4: Scope Mismatch Rejection
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Generate token for "drive" only
  2. Send "e_stop" command
- **Expected Result:** Command rejected
- **Pass Criteria:** Rejection with "insufficient_scope" error

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cryptographic implementation errors | H | Use well-tested libraries, security review |
| Clock skew affecting expiry | M | Allow small time tolerance, NTP sync |
| Token replay attacks | M | Include nonce, implement token binding |

## Dependencies

- **Blocked by:** M1-001, M3-006
- **Blocks:** M3-010
- **Related:** M1-005, M3-007

## References

- PRD Section: 8.2 (FR-6: Token enforcement)
- Design Decision: 16.4 (Cryptographic Standards)

## Open Questions

- Which JWT library to use?
- Token refresh mechanism needed for POC?
