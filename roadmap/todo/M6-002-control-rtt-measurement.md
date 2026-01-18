# M6-002: Implement Control RTT Measurement

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** Measurement
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want to measure control command round-trip time so that I can validate NFR-P2 targets and ensure responsive teleoperation.

## Requirements

### Functional Requirements
- Periodic ping/pong measurement over DataChannel
- Calculate RTT from monotonic timestamps
- Track RTT distribution over session duration

### Non-Functional Requirements
- NFR-P2: Control round-trip time (RTT) over the control channel
  - LAN: p50 ≤ 50ms
  - WAN: p50 ≤ 150ms

## Definition of Done

- [ ] Feature branch created (`feature/M6-002-control-rtt-measurement`)
- [ ] Ping message implementation with monotonic timestamp
- [ ] Pong response implementation
- [ ] RTT calculation logic
- [ ] Sample buffer for distribution tracking
- [ ] Configurable measurement interval
- [ ] Export to metrics data store
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: RTT Calculation
- **Preconditions:** Active DataChannel connection
- **Steps:**
  1. Send ping with timestamp T1
  2. Receive pong
  3. Calculate RTT = T2 - T1
- **Expected Result:** Valid RTT measurement
- **Pass Criteria:** RTT > 0, < expected max

### Test Case 2: Distribution Tracking
- **Preconditions:** Session running
- **Steps:**
  1. Collect 1000 RTT samples
  2. Calculate p50, p95, p99
- **Expected Result:** Valid percentile values
- **Pass Criteria:** Percentiles within expected bounds

### Test Case 3: LAN Baseline
- **Preconditions:** LAN environment
- **Steps:**
  1. Run measurement for 60 seconds
  2. Calculate p50 RTT
- **Expected Result:** Meets NFR-P2 LAN target
- **Pass Criteria:** p50 ≤ 50ms

### Test Case 4: Measurement Overhead
- **Preconditions:** High control rate session
- **Steps:**
  1. Run with measurement enabled
  2. Verify control messages not delayed
- **Expected Result:** Minimal overhead
- **Pass Criteria:** < 5% increase in control RTT

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clock drift between endpoints | M | Use relative measurements |
| Measurement affects performance | L | Low-frequency sampling option |
| Buffer overflow on high frequency | L | Ring buffer implementation |

## Dependencies

- **Blocked by:** M2-009 (DataChannel routing)
- **Blocks:** M6-005, M6-009, M6-011
- **Related:** M6-001, M6-003

## References

- PRD Section: 9.1 (Performance targets - NFR-P2)
- PRD Section: 12.1 (Metrics to collect)
- PRD Section: 12.2 (Measurement methods - Control RTT)

## Open Questions

- What measurement frequency for production vs testing?
- Should RTT spikes trigger alerts?
