# M7-002: Implement Adaptive Rate Control + Tail-Latency Guard

## Metadata
- **Milestone:** M7 - Research Alignment & Performance Hardening
- **Component:** Robot Agent
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want adaptive bitrate control with tail-latency guards so that the video stream stays responsive under variable networks without building latency queues.

## Requirements

### Functional Requirements
- Implement bitrate adaptation based on observed congestion control rate.
- Prefer frame dropping over buffering when latency spikes.
- Force keyframe reset when the encoder queue exceeds the target latency budget.

### Non-Functional Requirements
- Glass-to-glass latency p95 <= 300ms in WAN conditions.
- No multi-second latency buildup during bandwidth drops.

## Definition of Done

- [ ] Feature branch created (`feature/M7-002-adaptive-rate-control`)
- [ ] Headroom algorithm implemented (target bitrate = alpha * CC rate)
- [ ] Tail-latency guard detects queue age and triggers keyframe reset
- [ ] Resolution switches only on sustained bandwidth change
- [ ] Metrics emitted for bitrate, queue age, and drop rate
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Bandwidth Drop
- **Preconditions:** Session established
- **Steps:**
  1. Reduce bandwidth to 1 Mbps
  2. Observe bitrate adaptation
- **Expected Result:** Stream stays live with lower quality
- **Pass Criteria:** No latency buildup > 500ms

### Test Case 2: Tail-Latency Guard
- **Preconditions:** Session established
- **Steps:**
  1. Inject jitter and packet loss
  2. Observe queue age
- **Expected Result:** Guard triggers keyframe reset and drains queue
- **Pass Criteria:** Latency returns to target within 1s

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Over-aggressive drops | M | Tune thresholds via config |
| Quality oscillation | M | Add hysteresis for bitrate changes |
| Encoder limitations | M | Provide fallback config |

## Dependencies

- **Blocked by:** M1-002, M2-004
- **Blocks:** M7-003
- **Related:** M6-003, M6-004

## References

- Research: `science-researcher-ralph/researches/blockchain-kvm-robot-operations-2026-01-15/research-report.md` (Vidaptive/tail-latency insights)

## Open Questions

- Should we support VP9/AV1 for better low-bitrate quality?
- What is the default queue age threshold for keyframe reset?
