# M7-004: Implement ICE Restart + Network Handover Recovery

## Metadata
- **Milestone:** M7 - Research Alignment & Performance Hardening
- **Component:** Transport
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want automatic ICE restarts on network changes so that sessions recover within research targets when connectivity shifts.

## Requirements

### Functional Requirements
- Detect connection failure and trigger ICE restart.
- Rejoin signaling and restore media/control channels.
- Emit reconnection metrics for measurement harness.

### Non-Functional Requirements
- ICE restart p95 < 5s.
- No manual operator intervention for recovery.

## Definition of Done

- [ ] Feature branch created (`feature/M7-004-ice-restart-handover`)
- [ ] ICE restart logic implemented for console and robot agent
- [ ] Signaling supports reconnection flow
- [ ] Metrics emitted for restart time and success rate
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: WiFi to LTE Switch
- **Preconditions:** Active session
- **Steps:**
  1. Switch network interface
  2. Observe reconnect
- **Expected Result:** Session recovers automatically
- **Pass Criteria:** p95 < 5s

### Test Case 2: Temporary Drop
- **Preconditions:** Active session
- **Steps:**
  1. Drop network for 3s
  2. Restore network
- **Expected Result:** ICE restart completes
- **Pass Criteria:** Control resumes without re-auth

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser limitations | M | Document supported browsers |
| Re-auth complexity | M | Reuse capability token within TTL |

## Dependencies

- **Blocked by:** M2-006, M2-009, M7-001
- **Blocks:** M7-005
- **Related:** M6-001, M6-010

## References

- Research: `science-researcher-ralph/researches/blockchain-kvm-robot-operations-2026-01-15/research-report.md` (reconnect targets)

## Open Questions

- Should reconnect require explicit operator acknowledgement?
