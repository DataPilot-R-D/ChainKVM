# M6-001: Implement Session Setup Timer

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** Measurement
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want to measure session setup time so that I can validate NFR-P1 targets and identify bottlenecks in the authorization and transport establishment flow.

## Requirements

### Functional Requirements
- Measure total session setup duration from request to media flowing
- Break down into phases: auth time, policy evaluation, token issuance, ICE negotiation, media start

### Non-Functional Requirements
- NFR-P1: Session setup time (authorization + transport establishment)
  - LAN: p50 ≤ 2s, p95 ≤ 5s
  - WAN/NAT: p50 ≤ 5s, p95 ≤ 15s

## Definition of Done

- [ ] Timer instrumentation at session request start
- [ ] Timer instrumentation at each phase boundary
- [ ] Timer instrumentation at first media frame received
- [ ] Timestamps exported to measurement data store
- [ ] Phase breakdown visualization
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Timer Accuracy
- **Preconditions:** Measurement harness running
- **Steps:**
  1. Start session with timers enabled
  2. Compare measured duration to wall clock
- **Expected Result:** Measurements within 10ms accuracy
- **Pass Criteria:** Consistent results across 10 runs

### Test Case 2: Phase Breakdown
- **Preconditions:** Session setup instrumented
- **Steps:**
  1. Complete session setup
  2. Verify all phases captured
  3. Sum phases equal total
- **Expected Result:** Complete phase breakdown
- **Pass Criteria:** No gaps in timing

### Test Case 3: LAN Baseline
- **Preconditions:** LAN environment
- **Steps:**
  1. Run 100 session setups
  2. Calculate p50 and p95
- **Expected Result:** Meets NFR-P1 LAN targets
- **Pass Criteria:** p50 ≤ 2s, p95 ≤ 5s

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clock synchronization issues | M | Use monotonic timestamps where possible |
| Instrumentation overhead | L | Minimize logging in critical path |
| Variable network conditions | M | Control test environment |

## Dependencies

- **Blocked by:** M3-001 (Gateway), M2-004 (WebRTC setup)
- **Blocks:** M6-005, M6-009, M6-011
- **Related:** M6-002, M6-003

## References

- PRD Section: 9.1 (Performance targets - NFR-P1)
- PRD Section: 12.1 (Metrics to collect)
- PRD Section: 12.2 (Measurement methods)

## Open Questions

- Should we measure retry attempts separately?
- How to handle partial failures in timing?
