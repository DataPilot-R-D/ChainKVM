# M7-001: Implement Hybrid Topology (P2P Control + Relayed Video)

## Metadata
- **Milestone:** M7 - Research Alignment & Performance Hardening
- **Component:** Transport
- **Priority:** P0
- **Status:** Todo

## User Story

As a system architect, I want control traffic to avoid relay latency by using a direct P2P DataChannel while allowing video to use TURN when needed, so that control responsiveness stays within research latency targets under variable networks.

## Requirements

### Functional Requirements
- Establish a dedicated control DataChannel that prefers direct P2P connectivity.
- Allow video/media to use TURN relay without forcing control traffic through TURN.
- Provide fallback behavior when direct control P2P is not possible.

### Non-Functional Requirements
- Control channel RTT p95 <= 200ms on WAN conditions (baseline target).
- Session setup p95 <= 3s with hybrid topology enabled.

## Definition of Done

- [ ] Feature branch created (`feature/M7-001-hybrid-topology-control-p2p`)
- [ ] Signaling supports separate control channel negotiation
- [ ] Console establishes control DataChannel with P2P preference
- [ ] Robot agent accepts control channel and rejects relayed control when configured
- [ ] Fallback path documented for NAT-restricted environments
- [ ] Metrics added for control channel RTT and connectivity
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Direct Control Channel
- **Preconditions:** Both peers on LAN
- **Steps:**
  1. Start session
  2. Verify control channel uses direct candidate pair
- **Expected Result:** Control channel is P2P
- **Pass Criteria:** RTT <= 50ms

### Test Case 2: Relayed Video with P2P Control
- **Preconditions:** TURN enabled, NAT-restricted network
- **Steps:**
  1. Start session
  2. Verify video uses relay while control stays P2P if possible
- **Expected Result:** Mixed topology established
- **Pass Criteria:** Control RTT <= 200ms

### Test Case 3: Fallback When P2P Fails
- **Preconditions:** P2P blocked
- **Steps:**
  1. Start session
  2. Verify control falls back to relay
- **Expected Result:** Session still works
- **Pass Criteria:** Control remains functional

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| P2P blocked by NAT | M | Controlled fallback to relay |
| Signaling complexity | M | Keep control channel negotiation minimal |
| Mixed topology bugs | M | Add integration tests |

## Dependencies

- **Blocked by:** M2-004, M2-006, M2-009
- **Blocks:** M7-004, M7-005
- **Related:** M6-002, M6-004

## References

- Research: `science-researcher-ralph/researches/blockchain-kvm-robot-operations-2026-01-15/research-report.md` (hybrid WebRTC topology insight)

## Open Questions

- Should control channel always prefer P2P even on WAN?
- What is the acceptable fallback RTT when forced to relay?
