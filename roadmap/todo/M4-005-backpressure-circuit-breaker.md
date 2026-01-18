# M4-005: Implement Backpressure + Circuit Breaker

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Gateway
- **Priority:** P1
- **Status:** Todo

## User Story

As a gateway operator, I want backpressure and circuit breaker mechanisms so that ledger issues don't cascade to affect control operations.

## Requirements

### Functional Requirements
- FR-11: Ensure control path not affected by ledger slowdowns

### Non-Functional Requirements
- Circuit breaker triggers within 5 seconds of ledger unavailability
- Automatic recovery when ledger returns

## Definition of Done

- [ ] Feature branch created (`feature/M4-005-backpressure-circuit-breaker`)
- [ ] Backpressure detection (queue depth threshold)
- [ ] Circuit breaker implementation
- [ ] Failure detection logic
- [ ] Recovery detection logic
- [ ] Metrics for circuit state
- [ ] Alert generation
- [ ] Unit tests for patterns
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Backpressure Activation
- **Preconditions:** Queue configured with threshold
- **Steps:**
  1. Slow down ledger writes
  2. Queue events until threshold
  3. Verify backpressure signal
- **Expected Result:** Backpressure activated
- **Pass Criteria:** New events flagged

### Test Case 2: Circuit Breaker Open
- **Preconditions:** Ledger connected
- **Steps:**
  1. Make ledger unavailable
  2. Wait for failure detection
  3. Verify circuit opens
- **Expected Result:** Circuit breaker open
- **Pass Criteria:** Writes fail fast

### Test Case 3: Circuit Breaker Recovery
- **Preconditions:** Circuit breaker open
- **Steps:**
  1. Restore ledger
  2. Wait for recovery detection
  3. Verify circuit closes
- **Expected Result:** Normal operation resumes
- **Pass Criteria:** Writes succeed again

### Test Case 4: Control Path Isolation
- **Preconditions:** Circuit breaker open
- **Steps:**
  1. Send control commands
  2. Verify commands processed
- **Expected Result:** Control unaffected
- **Pass Criteria:** No latency increase

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Premature circuit break | M | Tunable thresholds |
| Slow recovery detection | M | Active health checks |
| Event loss during break | M | Local persistence |

## Dependencies

- **Blocked by:** M4-004
- **Blocks:** None
- **Related:** M4-012

## References

- PRD Section: 8.4 (FR-11: Non-blocking)
- Design Decision: 16.36 (Circuit Breaker Pattern)

## Open Questions

- Half-open state duration?
- Alert escalation policy?
