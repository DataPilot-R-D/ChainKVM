# M5-008: Implement Revocation Propagation Measurement

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Measurement
- **Priority:** P1
- **Status:** Todo

## User Story

As a system tester, I want to measure revocation propagation time so that I can verify the system meets security requirements.

## Requirements

### Functional Requirements
- Measure time from revocation API call to session termination
- Measure time from revocation to safe state

### Non-Functional Requirements
- Measurement accuracy < 10ms

## Definition of Done

- [ ] Timestamp capture at revocation API
- [ ] Timestamp capture at session close
- [ ] Timestamp capture at safe state entry
- [ ] Propagation time calculation
- [ ] Statistical analysis (p50, p95)
- [ ] Measurement report generation
- [ ] Unit tests for measurement
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: End-to-End Measurement
- **Preconditions:** Active session, measurement enabled
- **Steps:**
  1. Trigger revocation
  2. Capture all timestamps
  3. Calculate propagation time
- **Expected Result:** Accurate timing
- **Pass Criteria:** All timestamps captured

### Test Case 2: Statistical Collection
- **Preconditions:** Measurement system ready
- **Steps:**
  1. Run 100 revocation tests
  2. Collect timing data
  3. Calculate p50, p95
- **Expected Result:** Distribution captured
- **Pass Criteria:** Valid statistics

### Test Case 3: LAN vs WAN Comparison
- **Preconditions:** Both network conditions available
- **Steps:**
  1. Measure on LAN
  2. Measure on WAN (simulated)
  3. Compare results
- **Expected Result:** Network impact visible
- **Pass Criteria:** Clear differentiation

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clock synchronization | M | NTP sync, relative timing |
| Measurement overhead | L | Minimal instrumentation |
| Inconsistent network | M | Controlled test environment |

## Dependencies

- **Blocked by:** M5-003, M5-007
- **Blocks:** M5-012
- **Related:** M6-001

## References

- PRD Section: 12.1 (Metrics to collect)
- Design Decision: 16.26 (Revocation Strategy)

## Open Questions

- Acceptable propagation time threshold?
- Include in continuous monitoring?
