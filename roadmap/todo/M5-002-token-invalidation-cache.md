# M5-002: Implement Token Invalidation Cache

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want revoked tokens cached for fast lookup so that revocation checks don't add latency to operations.

## Requirements

### Functional Requirements
- FR-7: Token revocation must take effect quickly

### Non-Functional Requirements
- Revocation check < 1ms
- Cache must survive gateway restart

## Definition of Done

- [ ] Feature branch created (`feature/M5-002-token-invalidation-cache`)
- [ ] In-memory revocation cache
- [ ] Persistent backing store
- [ ] Cache invalidation on token expiry
- [ ] Cache synchronization (if multiple gateways)
- [ ] Cache size limits and eviction
- [ ] Metrics for cache hits/misses
- [ ] Unit tests for cache operations
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Cache Lookup Performance
- **Preconditions:** Cache with 10,000 entries
- **Steps:**
  1. Perform 10,000 lookups
  2. Measure average lookup time
- **Expected Result:** Fast lookups
- **Pass Criteria:** Average < 1ms

### Test Case 2: Revocation Addition
- **Preconditions:** Active token
- **Steps:**
  1. Add token to revocation cache
  2. Verify token lookup returns revoked
- **Expected Result:** Token marked revoked
- **Pass Criteria:** Immediate detection

### Test Case 3: Persistence Across Restart
- **Preconditions:** Revoked tokens in cache
- **Steps:**
  1. Restart gateway
  2. Check revocation cache
- **Expected Result:** Revocations preserved
- **Pass Criteria:** All entries recovered

### Test Case 4: Automatic Cleanup
- **Preconditions:** Expired token in cache
- **Steps:**
  1. Wait for token expiry + cleanup interval
  2. Verify token removed from cache
- **Expected Result:** Expired entries cleaned
- **Pass Criteria:** Memory not growing unbounded

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cache inconsistency | H | Single source of truth, sync protocol |
| Memory exhaustion | M | Bounded cache, automatic cleanup |
| Cold start delays | L | Pre-load from persistent store |

## Dependencies

- **Blocked by:** M5-001, M3-007
- **Blocks:** M5-003, M3-010
- **Related:** M5-008

## References

- PRD Section: 8.2 (FR-7: Revocation)
- Design Decision: 16.26 (Revocation Strategy)

## Open Questions

- Distributed cache needed for multi-gateway?
- Bloom filter for space efficiency?
