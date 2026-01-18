# M6-009: Run Baseline Measurement (LAN)

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** QA
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want to establish baseline performance measurements on LAN so that I can validate the system meets NFR targets under ideal conditions.

## Requirements

### Functional Requirements
- Measure all NFR metrics (P1 through P4) on LAN
- Run multiple sessions for statistical significance
- Document test environment configuration
- Capture raw data and aggregated statistics

### Non-Functional Requirements
- NFR-P1: Session setup < 3 seconds
- NFR-P2: Control RTT < 100ms (p95)
- NFR-P3: Video latency < 200ms (p95)
- NFR-P4: Control rate >= 20 Hz

## Definition of Done

- [ ] Feature branch created (`feature/M6-009-baseline-measurement-lan`)
- [ ] LAN test environment documented
- [ ] Minimum 10 test sessions completed
- [ ] NFR-P1 measurements collected
- [ ] NFR-P2 measurements collected
- [ ] NFR-P3 measurements collected
- [ ] NFR-P4 measurements collected
- [ ] Raw data exported and archived
- [ ] Baseline report generated
- [ ] Results reviewed with team
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: NFR-P1 - Session Setup
- **Preconditions:** LAN environment, fresh system state
- **Steps:**
  1. Initiate 10 operator sessions
  2. Measure time from request to video displayed
- **Expected Result:** Session setup times recorded
- **Pass Criteria:** p95 < 3 seconds

### Test Case 2: NFR-P2 - Control RTT
- **Preconditions:** Active session
- **Steps:**
  1. Send 1000 control commands
  2. Measure round-trip time for each
  3. Calculate p95
- **Expected Result:** Control RTT measurements
- **Pass Criteria:** p95 < 100ms

### Test Case 3: NFR-P3 - Video Latency
- **Preconditions:** Active session with video
- **Steps:**
  1. Use visual marker method
  2. Measure glass-to-glass latency
  3. Repeat 100 times
- **Expected Result:** Video latency measurements
- **Pass Criteria:** p95 < 200ms

### Test Case 4: NFR-P4 - Control Rate
- **Preconditions:** Active session
- **Steps:**
  1. Sustain control commands at 20 Hz
  2. Measure actual delivery rate
- **Expected Result:** Control rate measurements
- **Pass Criteria:** >= 20 Hz sustained

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Inconsistent test environment | H | Document and standardize setup |
| Measurement tool errors | M | Validate tools before testing |
| Insufficient sample size | M | Run additional sessions if needed |

## Dependencies

- **Blocked by:** M6-001, M6-002, M6-003, M6-004, M6-005, M6-006
- **Blocks:** M6-010, M6-011
- **Related:** M5-008, M5-012

## References

- PRD Section: 9.1 (NFR-P1 to NFR-P4 targets)
- PRD Section: 12.1 (Metrics to collect)
- PRD Section: 12.2 (Measurement methods)

## Open Questions

- What specific hardware for baseline?
- How many sessions for statistical significance?
