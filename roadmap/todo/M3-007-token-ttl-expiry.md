# M3-007: Implement Token TTL/Expiry Tracking

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P1
- **Status:** Todo

## User Story

As a security administrator, I want tokens to expire automatically so that stale permissions are revoked.

## Requirements

### Functional Requirements
- FR-5: Tokens have TTL and expire automatically
- Track active tokens and their expiry times

### Non-Functional Requirements
- Expiry check overhead < 1ms

## Definition of Done

- [ ] Token expiry claim (exp) handling
- [ ] Active token registry
- [ ] Automatic expiry cleanup
- [ ] Near-expiry warning generation
- [ ] Token refresh capability
- [ ] Expiry audit logging
- [ ] Unit tests for expiry logic
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Token Expiry
- **Preconditions:** Token with 5 second TTL
- **Steps:**
  1. Generate token
  2. Verify token valid immediately
  3. Wait 6 seconds
  4. Verify token expired
- **Expected Result:** Token becomes invalid
- **Pass Criteria:** Validation fails after expiry

### Test Case 2: Expiry Warning
- **Preconditions:** Token with 60 second TTL
- **Steps:**
  1. Generate token
  2. Wait until 10 seconds before expiry
  3. Check for warning
- **Expected Result:** Warning generated
- **Pass Criteria:** Near-expiry event fired

### Test Case 3: Token Refresh
- **Preconditions:** Valid token near expiry
- **Steps:**
  1. Request token refresh
  2. Verify new token issued
  3. Verify old token invalidated
- **Expected Result:** Seamless token refresh
- **Pass Criteria:** No gap in authorization

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clock skew issues | M | Allow small tolerance, NTP sync |
| Refresh race conditions | M | Atomic refresh operation |
| Memory growth from tracking | L | Efficient cleanup, bounded registry |

## Dependencies

- **Blocked by:** M3-006
- **Blocks:** M5-002
- **Related:** M1-004

## References

- PRD Section: 8.2 (FR-5: Token TTL)
- Design Decision: 16.25 (TTL Strategy)

## Open Questions

- Default TTL for session tokens?
- Maximum refresh count?
