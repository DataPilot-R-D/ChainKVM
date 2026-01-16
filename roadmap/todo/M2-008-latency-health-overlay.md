# M2-008: Implement Latency/Health Overlay

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P2
- **Status:** Todo

## User Story

As an operator, I want to see real-time connection health metrics so that I can adjust my control behavior based on network conditions.

## Requirements

### Functional Requirements
- Display round-trip time (RTT)
- Display packet loss percentage
- Display video bitrate

### Non-Functional Requirements
- Metrics updated at least once per second
- Minimal performance impact

## Definition of Done

- [ ] RTT display (ms)
- [ ] Packet loss display (%)
- [ ] Video bitrate display (Mbps)
- [ ] Frame rate display (fps)
- [ ] Health indicator (good/warning/critical)
- [ ] Toggle overlay visibility
- [ ] Unit tests for metrics display
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Metrics Display
- **Preconditions:** Connected session
- **Steps:**
  1. Enable overlay
  2. Observe metrics
  3. Verify values reasonable
- **Expected Result:** Metrics displayed
- **Pass Criteria:** RTT, loss, bitrate shown

### Test Case 2: Metrics Update
- **Preconditions:** Overlay visible
- **Steps:**
  1. Observe RTT over 10 seconds
  2. Introduce network latency
  3. Verify RTT increases
- **Expected Result:** Real-time updates
- **Pass Criteria:** Reflects network changes

### Test Case 3: Health Indicator
- **Preconditions:** Overlay visible
- **Steps:**
  1. Simulate good network (RTT < 50ms)
  2. Simulate degraded network (RTT > 200ms)
  3. Observe indicator changes
- **Expected Result:** Color-coded health
- **Pass Criteria:** Green/yellow/red appropriate

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Metrics collection overhead | L | Efficient WebRTC stats API usage |
| Distracting overlay | L | Allow hiding, unobtrusive placement |
| Inaccurate metrics | M | Validate against known conditions |

## Dependencies

- **Blocked by:** M2-001, M2-004
- **Blocks:** M6-002, M6-004
- **Related:** M2-007

## References

- PRD Section: 12.1 (Metrics to collect)
- Design Decision: 16.16 (Metrics Collection)

## Open Questions

- Historical metrics graph needed?
- Export metrics for debugging?
