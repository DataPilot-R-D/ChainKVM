# M7-003: Tune Low-Latency Buffering Strategy

## Metadata
- **Milestone:** M7 - Research Alignment & Performance Hardening
- **Component:** Web Console
- **Priority:** P1
- **Status:** Todo

## User Story

As a system architect, I want the client to favor the live edge by minimizing buffering so that end-to-end latency stays within research targets even under jitter.

## Requirements

### Functional Requirements
- Configure WebRTC parameters for low-latency playback where supported.
- Prefer frame drops over buffer growth when jitter spikes.
- Expose a low-latency mode toggle in the console.

### Non-Functional Requirements
- Glass-to-glass latency p50 <= 150ms on LAN.
- Latency increases <= 50ms during jitter spikes.

## Definition of Done

- [ ] Feature branch created (`feature/M7-003-low-latency-buffering`)
- [ ] Low-latency configuration applied to WebRTC tracks
- [ ] Client-side buffer behavior documented
- [ ] Metrics for latency delta under jitter
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Low-Latency Mode
- **Preconditions:** Session established
- **Steps:**
  1. Enable low-latency mode
  2. Measure G2G latency
- **Expected Result:** Latency decreases
- **Pass Criteria:** p50 <= 150ms on LAN

### Test Case 2: Jitter Spike
- **Preconditions:** Low-latency mode enabled
- **Steps:**
  1. Inject jitter (100ms)
  2. Observe video behavior
- **Expected Result:** Frames drop but latency does not grow
- **Pass Criteria:** Added latency <= 50ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser constraints | M | Document unsupported browsers |
| Visual stutter | L | Provide user toggle |

## Dependencies

- **Blocked by:** M2-004, M7-002
- **Blocks:** None
- **Related:** M6-003, M6-004

## References

- Research: `science-researcher-ralph/researches/blockchain-kvm-robot-operations-2026-01-15/research-report.md` (buffering/jitter guidance)

## Open Questions

- Which browsers expose sufficient controls for jitter buffer tuning?
