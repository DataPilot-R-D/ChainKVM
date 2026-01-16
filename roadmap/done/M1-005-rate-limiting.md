# M1-005: Implement Rate Limiting Enforcement

## Metadata
- **Milestone:** M1 - Robot Agent Video Stream & Local Control
- **Component:** Robot Agent
- **Priority:** P1
- **Status:** Done

## User Story

As a security administrator, I want the Robot Agent to enforce rate limits on commands so that denial-of-service attacks and runaway automation are prevented.

## Requirements

### Functional Requirements
- FR-15: The Robot Agent SHALL enforce rate limiting per session, rejecting commands that exceed policy thresholds

### Non-Functional Requirements
- Rate limiting overhead should add < 1ms to command processing

## Definition of Done

- [x] Token bucket algorithm implemented
- [x] Per-session rate tracking
- [x] Configurable rate limits (commands/second)
- [x] Burst allowance configuration
- [x] Rate limit exceeded logging
- [x] Unit tests for rate limiting (12 tests)
- [x] Code reviewed and merged
- [x] Tests passing

## Implementation Notes

- Token bucket with configurable refill rate and burst size
- E-Stop always bypasses rate limiting for safety
- Separate buckets per message type (Drive, KVMKey, KVMMouse)
- `RateLimiterConfig` struct for configuration:
  - `DriveHz`, `KVMHz`, `EStopHz` - rate limits per type
  - `BurstSize` - max tokens (defaults to 1)
  - `LogDenials` - whether to log rate limit violations

## Acceptance Tests (UAT)

### Test Case 1: Normal Rate Acceptance
- **Preconditions:** Rate limit set to 100 cmd/s
- **Steps:**
  1. Send 50 commands in 1 second
  2. Verify all accepted
- **Expected Result:** All commands processed
- **Pass Criteria:** 0 rejections

### Test Case 2: Rate Limit Exceeded
- **Preconditions:** Rate limit set to 100 cmd/s
- **Steps:**
  1. Send 150 commands in 1 second
  2. Count rejections
- **Expected Result:** ~50 commands rejected
- **Pass Criteria:** Rejections with "rate_limit_exceeded" error

### Test Case 3: Burst Handling
- **Preconditions:** Rate limit 100 cmd/s, burst allowance 20
- **Steps:**
  1. Wait 1 second (build burst credits)
  2. Send 120 commands in 0.5 seconds
- **Expected Result:** All commands accepted (burst allows)
- **Pass Criteria:** 0 rejections due to burst tokens

### Test Case 4: Per-Session Isolation
- **Preconditions:** Rate limit 100 cmd/s per session
- **Steps:**
  1. Session A sends 100 commands
  2. Session B sends 100 commands
- **Expected Result:** Both sessions process all commands
- **Pass Criteria:** No cross-session rate limiting

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rate limit too restrictive | M | Make configurable, test with real workloads |
| Memory growth with sessions | L | Clean up inactive sessions |
| Timing attacks | L | Constant-time rate limit checks |

## Dependencies

- **Blocked by:** M1-001, M1-003
- **Blocks:** M3-013
- **Related:** M1-004, M5-006

## References

- PRD Section: 8.5 (FR-15: Rate limiting)
- Design Decision: 16.5 (Rate Limit Algorithm)

## Open Questions

- ~~Default rate limits for POC?~~ → Configurable via RateLimiterConfig, defaults to provided Hz values
- ~~Should E-Stop bypass rate limits?~~ → Yes, E-Stop always bypasses for safety (implemented)
