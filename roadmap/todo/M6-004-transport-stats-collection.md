# M6-004: Implement Transport Stats Collection

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** Measurement
- **Priority:** P1
- **Status:** Todo

## User Story

As a system architect, I want to collect transport-level statistics so that I can validate NFR-P4 targets and diagnose network-related issues.

## Requirements

### Functional Requirements
- Collect WebRTC getStats() metrics
- Track bitrate, packet loss, jitter
- Monitor control message throughput

### Non-Functional Requirements
- NFR-P4: Control rate
  - Sustain ≥ 20 Hz control messages without drops under stable network

## Definition of Done

- [ ] WebRTC stats collection implementation
- [ ] Bitrate tracking (video and data)
- [ ] Packet loss calculation
- [ ] Jitter measurement
- [ ] Control message rate tracking
- [ ] Drop detection and logging
- [ ] Export to metrics data store
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Stats Collection
- **Preconditions:** Active WebRTC session
- **Steps:**
  1. Call getStats() periodically
  2. Parse relevant metrics
  3. Store in metrics buffer
- **Expected Result:** Complete stats collected
- **Pass Criteria:** All expected fields present

### Test Case 2: Control Rate Measurement
- **Preconditions:** Session with active control
- **Steps:**
  1. Send control at 30 Hz
  2. Measure received rate
  3. Verify no drops
- **Expected Result:** 30 Hz sustained
- **Pass Criteria:** ≥ 99% delivery rate

### Test Case 3: Packet Loss Detection
- **Preconditions:** Session running
- **Steps:**
  1. Introduce simulated packet loss
  2. Verify loss detected in stats
- **Expected Result:** Loss accurately reported
- **Pass Criteria:** Reported loss within 1% of actual

### Test Case 4: NFR-P4 Validation
- **Preconditions:** Stable network
- **Steps:**
  1. Send 20 Hz control for 5 minutes
  2. Verify no drops
- **Expected Result:** Meets NFR-P4
- **Pass Criteria:** ≥ 20 Hz sustained, 0 drops

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser getStats() inconsistency | M | Abstract stats interface |
| Stats collection overhead | L | Configurable interval |
| Missing metrics on some platforms | M | Graceful degradation |

## Dependencies

- **Blocked by:** M2-004 (WebRTC peer connection)
- **Blocks:** M6-005, M6-009, M6-011
- **Related:** M6-002, M6-003

## References

- PRD Section: 9.1 (Performance targets - NFR-P4)
- PRD Section: 12.1 (Metrics to collect - bitrate, packet loss, jitter)

## Open Questions

- Which WebRTC stats are essential vs nice-to-have?
- How to normalize stats across browsers?
