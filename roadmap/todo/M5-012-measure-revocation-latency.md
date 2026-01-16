# M5-012: Measure Revocation Latency

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Measurement
- **Priority:** P1
- **Status:** Todo

## User Story

As a system architect, I want revocation latency measurements so that I can verify the system meets security and safety requirements.

## Requirements

### Functional Requirements
- Measure end-to-end revocation latency
- Compare against requirements

### Non-Functional Requirements
- Measurement accuracy < 10ms
- Repeatable results

## Definition of Done

- [ ] Measurement methodology defined
- [ ] Instrumentation in place
- [ ] Data collection mechanism
- [ ] Statistical analysis (p50, p95, p99)
- [ ] Comparison against targets
- [ ] Report generation
- [ ] Recommendations documented
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: LAN Revocation Latency
- **Preconditions:** LAN test environment
- **Steps:**
  1. Run 100 revocation tests
  2. Collect latency data
  3. Calculate statistics
- **Expected Result:** Latency distribution
- **Pass Criteria:** p95 < 1 second

### Test Case 2: WAN Revocation Latency
- **Preconditions:** WAN simulation (100ms RTT)
- **Steps:**
  1. Run 100 revocation tests
  2. Collect latency data
  3. Calculate statistics
- **Expected Result:** Latency distribution
- **Pass Criteria:** p95 < 2 seconds

### Test Case 3: Component Breakdown
- **Preconditions:** Instrumentation complete
- **Steps:**
  1. Measure Gateway processing time
  2. Measure notification delivery time
  3. Measure Robot Agent response time
  4. Sum components
- **Expected Result:** Latency breakdown
- **Pass Criteria:** Bottleneck identified

### Test Case 4: Trend Analysis
- **Preconditions:** Multiple measurement runs
- **Steps:**
  1. Collect data over multiple runs
  2. Analyze for trends
  3. Check for degradation
- **Expected Result:** Consistent performance
- **Pass Criteria:** No significant degradation

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clock synchronization | M | NTP, relative timing |
| Network variability | M | Controlled environment |
| Insufficient samples | L | Adequate test runs |

## Dependencies

- **Blocked by:** M5-008
- **Blocks:** M6-011
- **Related:** M6-001

## References

- PRD Section: 12.1 (Metrics to collect)
- Design Decision: 16.26 (Revocation Strategy)

## Open Questions

- Target revocation latency?
- Continuous monitoring post-POC?

## Expected Results

| Metric | LAN Target | WAN Target |
|--------|------------|------------|
| p50 | < 500ms | < 1s |
| p95 | < 1s | < 2s |
| p99 | < 2s | < 5s |
