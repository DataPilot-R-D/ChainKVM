# M3-010: Implement Robot Agent Token Validation

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a Robot Agent, I want to validate capability tokens so that only authorized commands are executed.

## Requirements

### Functional Requirements
- FR-6: The Robot Agent SHALL validate capability tokens before accepting any control command

### Non-Functional Requirements
- Token validation < 5ms

## Definition of Done

- [ ] Token signature verification
- [ ] Expiry validation
- [ ] Scope checking (allowed actions)
- [ ] Revocation status check (optional)
- [ ] Token caching for performance
- [ ] Validation failure logging
- [ ] Unit tests for validation
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Valid Token Acceptance
- **Preconditions:** Robot Agent with Gateway public key
- **Steps:**
  1. Send command with valid token
  2. Verify command executed
- **Expected Result:** Command accepted
- **Pass Criteria:** No validation errors

### Test Case 2: Scope Enforcement
- **Preconditions:** Token with "drive" scope only
- **Steps:**
  1. Send drive command (should work)
  2. Send KVM command (should fail)
- **Expected Result:** Scope enforced
- **Pass Criteria:** Drive allowed, KVM denied

### Test Case 3: Token Validation Performance
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Send 1000 commands with tokens
  2. Measure validation overhead
- **Expected Result:** Fast validation
- **Pass Criteria:** Average < 5ms

### Test Case 4: Signature Mismatch
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Send command with tampered token
- **Expected Result:** Command rejected
- **Pass Criteria:** "invalid_signature" error

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Key synchronization | M | Secure key distribution |
| Clock drift | M | Time tolerance, NTP |
| Offline validation limits | M | Cached revocation list |

## Dependencies

- **Blocked by:** M3-006, M1-004
- **Blocks:** M5-004
- **Related:** M1-005

## References

- PRD Section: 8.2 (FR-6: Token enforcement)
- Design Decision: 16.28 (Validation Architecture)

## Open Questions

- How to handle Gateway unavailability?
- Key rotation procedure?
