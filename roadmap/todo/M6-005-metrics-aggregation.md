# M6-005: Implement Metrics Aggregation

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** Measurement
- **Priority:** P1
- **Status:** Todo

## User Story

As a system architect, I want to aggregate raw metrics into statistical summaries so that I can validate NFR targets and generate meaningful reports.

## Requirements

### Functional Requirements
- Calculate percentiles (p50, p95, p99)
- Calculate min, max, mean, stddev
- Aggregate per session and across sessions
- Support time-windowed aggregation

### Non-Functional Requirements
- Aggregation must handle large sample sets efficiently

## Definition of Done

- [ ] Feature branch created (`feature/M6-005-metrics-aggregation`)
- [ ] Percentile calculation (p50, p95, p99)
- [ ] Basic statistics (min, max, mean, stddev)
- [ ] Per-session aggregation
- [ ] Cross-session aggregation
- [ ] Time-windowed aggregation
- [ ] Memory-efficient implementation
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Percentile Accuracy
- **Preconditions:** Sample data set with known distribution
- **Steps:**
  1. Input 10000 samples
  2. Calculate p50, p95, p99
  3. Compare to expected values
- **Expected Result:** Accurate percentiles
- **Pass Criteria:** Within 1% of expected

### Test Case 2: Large Sample Set
- **Preconditions:** Memory-limited environment
- **Steps:**
  1. Input 1 million samples
  2. Verify aggregation completes
  3. Check memory usage
- **Expected Result:** Efficient processing
- **Pass Criteria:** < 100MB memory

### Test Case 3: Session Aggregation
- **Preconditions:** Multiple sessions completed
- **Steps:**
  1. Aggregate metrics from 10 sessions
  2. Calculate overall statistics
- **Expected Result:** Combined statistics
- **Pass Criteria:** All sessions included

### Test Case 4: Time Window
- **Preconditions:** Continuous measurement data
- **Steps:**
  1. Request 1-minute window aggregation
  2. Verify only samples from window included
- **Expected Result:** Correct time filtering
- **Pass Criteria:** No samples outside window

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Memory exhaustion | M | Streaming percentile algorithms |
| Calculation accuracy | L | Use proven statistical libraries |
| Performance impact | L | Background aggregation |

## Dependencies

- **Blocked by:** M6-001, M6-002, M6-003, M6-004
- **Blocks:** M6-007, M6-008, M6-011
- **Related:** M6-006

## References

- PRD Section: 12.1 (Metrics to collect)
- PRD Section: 12.2 (Measurement methods)

## Open Questions

- Streaming vs batch aggregation?
- How long to retain raw samples?
