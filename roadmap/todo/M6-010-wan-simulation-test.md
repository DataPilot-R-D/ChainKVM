# M6-010: Run WAN Simulation Test

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** QA
- **Priority:** P1
- **Status:** Todo

## User Story

As a system architect, I want to test system performance under simulated WAN conditions so that I can validate the system behaves acceptably in realistic deployment scenarios.

## Requirements

### Functional Requirements
- Simulate network conditions (latency, jitter, packet loss)
- Measure all NFR metrics under WAN simulation
- Test multiple network profiles (good, degraded, poor)
- Compare results against LAN baseline

### Non-Functional Requirements
- NFR-P1: Session setup < 3 seconds (may relax for WAN)
- NFR-P2: Control RTT < 100ms (p95, adjusted for network RTT)
- NFR-P3: Video latency < 200ms (p95, adjusted for network RTT)
- NFR-P4: Control rate >= 20 Hz (verify under packet loss)

## Definition of Done

- [ ] WAN simulation tool configured (tc/netem or similar)
- [ ] Network profiles defined (good, degraded, poor)
- [ ] Tests executed for each profile
- [ ] NFR measurements collected per profile
- [ ] Comparison report vs LAN baseline
- [ ] Graceful degradation behavior documented
- [ ] Results reviewed with team

## Acceptance Tests (UAT)

### Test Case 1: Good WAN (50ms RTT, 0.1% loss)
- **Preconditions:** WAN simulation active
- **Steps:**
  1. Configure 50ms latency, 0.1% packet loss
  2. Run full measurement suite
  3. Verify NFR targets met (adjusted for 50ms base)
- **Expected Result:** NFR targets achievable
- **Pass Criteria:** All NFRs pass (adjusted)

### Test Case 2: Degraded WAN (100ms RTT, 1% loss)
- **Preconditions:** WAN simulation active
- **Steps:**
  1. Configure 100ms latency, 1% packet loss
  2. Run full measurement suite
  3. Document any NFR misses
- **Expected Result:** Acceptable degradation
- **Pass Criteria:** System remains usable

### Test Case 3: Poor WAN (200ms RTT, 5% loss)
- **Preconditions:** WAN simulation active
- **Steps:**
  1. Configure 200ms latency, 5% packet loss
  2. Run full measurement suite
  3. Document behavior and limits
- **Expected Result:** Graceful degradation
- **Pass Criteria:** No crashes, clear feedback

### Test Case 4: Control Rate Under Loss
- **Preconditions:** Various packet loss rates
- **Steps:**
  1. Test control rate at 0%, 1%, 5% loss
  2. Verify 20 Hz maintained or degradation curve
- **Expected Result:** Control rate behavior documented
- **Pass Criteria:** Predictable degradation

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Simulation accuracy | M | Use validated tools (tc/netem) |
| Test environment isolation | M | Dedicated test network |
| Result variability | M | Multiple runs per profile |

## Dependencies

- **Blocked by:** M6-009
- **Blocks:** M6-011
- **Related:** M2-005 (NAT/TURN)

## References

- PRD Section: 9.1 (NFR-P1 to NFR-P4 targets)
- PRD Section: 12.1 (Metrics to collect)
- PRD Section: 12.2 (Measurement methods)

## Open Questions

- What WAN profiles represent target deployments?
- Should we test with TURN relay active?
