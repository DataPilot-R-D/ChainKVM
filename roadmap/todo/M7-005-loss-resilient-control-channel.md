# M7-005: Improve Control Channel Loss Resilience

## Metadata
- **Milestone:** M7 - Research Alignment & Performance Hardening
- **Component:** Transport
- **Priority:** P1
- **Status:** Todo

## User Story

As a system architect, I want the control channel to remain usable under packet loss so that operators retain control in degraded networks.

## Requirements

### Functional Requirements
- Configure DataChannel reliability settings for control traffic.
- Add optional duplicate/ack logic for critical commands (e-stop).
- Emit packet loss metrics and control drop counts.

### Non-Functional Requirements
- Control channel functional at 5% loss (no stalls).
- Control channel degraded but functional at 15% loss.

## Definition of Done

- [ ] Feature branch created (`feature/M7-005-loss-resilient-control-channel`)
- [ ] DataChannel reliability profile defined (ordered vs unordered)
- [ ] E-stop redundancy implemented
- [ ] Loss metrics reported to measurement harness
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Moderate Loss
- **Preconditions:** Session established
- **Steps:**
  1. Inject 5% packet loss
  2. Send control commands
- **Expected Result:** No stalls
- **Pass Criteria:** Commands acknowledged

### Test Case 2: High Loss
- **Preconditions:** Session established
- **Steps:**
  1. Inject 15% packet loss
  2. Send control commands
- **Expected Result:** Degraded but usable
- **Pass Criteria:** Control continues without disconnect

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Increased bandwidth | L | Limit redundancy to critical commands |
| Over-ack traffic | L | Throttle ack frequency |

## Dependencies

- **Blocked by:** M1-003, M2-009, M7-001, M7-004
- **Blocks:** None
- **Related:** M6-002, M6-004

## References

- Research: `science-researcher-ralph/researches/blockchain-kvm-robot-operations-2026-01-15/research-report.md` (packet loss tolerance)

## Open Questions

- Should reliability be dynamic based on measured loss?
