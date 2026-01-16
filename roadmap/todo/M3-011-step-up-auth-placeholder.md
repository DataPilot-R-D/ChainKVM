# M3-011: Implement Step-Up Auth Placeholder (TOTP)

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P3
- **Status:** Todo

## User Story

As a security administrator, I want optional step-up authentication so that high-risk operations require additional verification.

## Requirements

### Functional Requirements
- FR-3: Support optional step-up authentication (TOTP placeholder)

### Non-Functional Requirements
- Step-up should not add more than 5 seconds to flow

## Definition of Done

- [ ] TOTP generation/validation library integrated
- [ ] Step-up challenge API endpoint
- [ ] Policy-based step-up triggers
- [ ] TOTP enrollment placeholder
- [ ] Bypass for development mode
- [ ] Unit tests for TOTP
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Step-Up Challenge
- **Preconditions:** Policy requires step-up for E-Stop
- **Steps:**
  1. Attempt E-Stop operation
  2. Receive TOTP challenge
  3. Enter valid TOTP
  4. Operation completes
- **Expected Result:** Step-up successful
- **Pass Criteria:** Operation allowed after TOTP

### Test Case 2: Invalid TOTP
- **Preconditions:** Step-up required
- **Steps:**
  1. Receive TOTP challenge
  2. Enter invalid TOTP
- **Expected Result:** Operation denied
- **Pass Criteria:** "invalid_totp" error

### Test Case 3: Step-Up Timeout
- **Preconditions:** Step-up required
- **Steps:**
  1. Receive TOTP challenge
  2. Wait beyond timeout
  3. Enter valid TOTP
- **Expected Result:** Challenge expired
- **Pass Criteria:** "challenge_expired" error

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| User friction | M | Only for high-risk operations |
| TOTP device loss | M | Recovery codes, admin override |
| Clock synchronization | L | Tolerance window |

## Dependencies

- **Blocked by:** M3-005
- **Blocks:** None (optional feature)
- **Related:** M3-006

## References

- PRD Section: 8.1 (FR-3: Step-up auth)
- Design Decision: 16.29 (MFA Strategy)

## Open Questions

- Which operations require step-up?
- Alternative to TOTP (push notification)?
