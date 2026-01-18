# M6-003: Implement Video Latency Measurement

## Metadata
- **Milestone:** M6 - Measurement Harness & Report
- **Component:** Measurement
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want to measure end-to-end video latency so that I can validate NFR-P3 targets and ensure operators have responsive visual feedback.

## Requirements

### Functional Requirements
- Overlay server timestamp on video frames at capture
- Client extracts timestamp and compares to local time
- Support relative delta measurement for clock sync issues

### Non-Functional Requirements
- NFR-P3: Video latency
  - LAN: p50 ≤ 200ms (screen-to-screen)
  - WAN: p50 ≤ 400ms (screen-to-screen)

## Definition of Done

- [ ] Feature branch created (`feature/M6-003-video-latency-measurement`)
- [ ] Timestamp overlay on video frames (Robot Agent)
- [ ] Timestamp extraction on Web Console
- [ ] Latency calculation with clock offset handling
- [ ] Distribution tracking over session
- [ ] Optional "timer-in-frame" external verification
- [ ] Export to metrics data store
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Timestamp Embedding
- **Preconditions:** Video capture running
- **Steps:**
  1. Capture video frame
  2. Verify timestamp embedded
  3. Verify timestamp readable on display
- **Expected Result:** Timestamp visible and accurate
- **Pass Criteria:** Timestamp matches server time

### Test Case 2: Latency Calculation
- **Preconditions:** Video streaming
- **Steps:**
  1. Extract timestamp from displayed frame
  2. Compare to local clock
  3. Calculate E2E latency
- **Expected Result:** Valid latency measurement
- **Pass Criteria:** Latency > encoding time, < 2 seconds

### Test Case 3: LAN Baseline
- **Preconditions:** LAN environment
- **Steps:**
  1. Measure latency for 100 frames
  2. Calculate p50 latency
- **Expected Result:** Meets NFR-P3 LAN target
- **Pass Criteria:** p50 ≤ 200ms

### Test Case 4: Clock Sync Handling
- **Preconditions:** Clock offset between endpoints
- **Steps:**
  1. Measure relative latency (delta changes)
  2. Verify consistent measurements despite offset
- **Expected Result:** Accurate relative measurements
- **Pass Criteria:** Variance < 20ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Clock synchronization required | H | Relative delta method available |
| Timestamp encoding impacts quality | L | Use non-visible overlay option |
| Frame extraction timing | M | Use consistent measurement point |

## Dependencies

- **Blocked by:** M1-002 (Camera capture), M2-002 (Video rendering)
- **Blocks:** M6-005, M6-009, M6-011
- **Related:** M6-001, M6-002

## References

- PRD Section: 9.1 (Performance targets - NFR-P3)
- PRD Section: 12.1 (Metrics to collect)
- PRD Section: 12.2 (Measurement methods - Video latency)

## Open Questions

- Use NTP sync or relative measurement?
- Visible vs hidden timestamp overlay?
