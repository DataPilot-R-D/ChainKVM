# M3-008: Implement Token Revocation Mechanism

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P1
- **Status:** Todo

## User Story

As a security administrator, I want to revoke tokens immediately so that compromised or unauthorized sessions can be terminated.

## Requirements

### Functional Requirements
- FR-7: Support immediate revocation of credentials/tokens

### Non-Functional Requirements
- Revocation propagation < 1 second

## Definition of Done

- [ ] Revocation API endpoint
- [ ] Revocation list storage
- [ ] Revocation check in validation
- [ ] Revocation event publishing
- [ ] Bulk revocation support
- [ ] Revocation audit logging
- [ ] Unit tests for revocation
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Single Token Revocation
- **Preconditions:** Valid token in use
- **Steps:**
  1. Revoke token via API
  2. Attempt to use revoked token
- **Expected Result:** Token rejected
- **Pass Criteria:** "token_revoked" error

### Test Case 2: Revocation Propagation
- **Preconditions:** Token in use by Robot Agent
- **Steps:**
  1. Revoke token at Gateway
  2. Measure time until Robot Agent rejects
- **Expected Result:** Fast propagation
- **Pass Criteria:** Propagation < 1 second

### Test Case 3: Bulk Revocation
- **Preconditions:** Multiple tokens for same user
- **Steps:**
  1. Revoke all tokens for user
  2. Verify all tokens invalid
- **Expected Result:** All tokens revoked
- **Pass Criteria:** 100% of tokens rejected

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Revocation list growth | M | Cleanup expired entries |
| Propagation delay | H | Push notifications, fast checks |
| Race conditions | M | Atomic revocation, ordering |

## Dependencies

- **Blocked by:** M3-006, M3-007
- **Blocks:** M5-001, M5-002
- **Related:** M5-003

## References

- PRD Section: 8.2 (FR-7: Revocation)
- Design Decision: 16.26 (Revocation Strategy)

## Open Questions

- Revocation list vs status endpoint?
- Revocation reason tracking?
