# ChainKVM POC Roadmap

## Overview

This roadmap tracks the implementation of the ChainKVM Proof of Concept (POC), a decentralized identity and policy-controlled remote KVM/robot operation system. The POC demonstrates secure, auditable remote control with sub-second latency and immutable audit trails.

## How to Use This Roadmap

### Task States

Tasks flow through three directories:

1. **`todo/`** - Pending tasks not yet started
2. **`in_progress/`** - Tasks currently being worked on
3. **`done/`** - Completed tasks

### Moving Tasks

When starting work on a task:
```bash
mv roadmap/todo/M1-001-robot-agent-architecture.md roadmap/in_progress/
```

When completing a task (⛔ ONLY after PR is merged):
```bash
mv roadmap/in_progress/M1-001-robot-agent-architecture.md roadmap/done/
```

### Task Completion Workflow (3 Phases)

**Phase 1: Implementation**
- Create feature branch
- Move task to `in_progress/`
- Implement with TDD
- Create PR

**Phase 2: Automated Review**
- Run `/pr-review-toolkit:review-pr`
- Address any issues found
- Re-run review until all checks pass

**Phase 3: Completion**
- Merge PR to main
- Move task to `done/`
- Delete feature branch

**A task is NOT complete until Phase 3 is done.**

### Task Naming Convention

- Format: `M[milestone]-[3-digit-sequence]-[kebab-case-name].md`
- Example: `M1-001-robot-agent-architecture.md`

### Priority Levels

| Priority | Meaning |
|----------|---------|
| P0 | Critical path - must complete for milestone |
| P1 | Important - should complete for milestone |
| P2 | Nice to have - can defer if needed |
| P3 | Optional - future enhancement |

---

## Milestone Dependency Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ChainKVM POC Milestones                            │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────┐
    │   M1: Robot Agent │
    │  Video Stream &   │
    │  Local Control    │
    │    (8 tasks)      │
    └────────┬──────────┘
             │
             ▼
    ┌───────────────────┐         ┌───────────────────┐
    │  M2: Web Console  │         │                   │
    │   & WebRTC        │────────▶│   M3: Gateway     │
    │   Connection      │         │   Policy &        │
    │    (10 tasks)     │         │   Capability      │
    └───────────────────┘         │   Tokens          │
                                  │    (14 tasks)     │
                                  └────────┬──────────┘
                                           │
                                           ▼
                                  ┌───────────────────┐
                                  │  M4: Ledger       │
                                  │  Integration &    │
                                  │  Audit Trail      │
                                  │    (12 tasks)     │
                                  └────────┬──────────┘
                                           │
                                           ▼
                                  ┌───────────────────┐
                                  │  M5: Revocation   │
                                  │  + Safe-Stop      │
                                  │  Integration      │
                                  │    (12 tasks)     │
                                  └────────┬──────────┘
                                           │
                                           ▼
                                  ┌───────────────────┐
                                  │  M6: Measurement  │
                                  │  Harness &        │
                                  │  Report           │
                                  │    (12 tasks)     │
                                  └───────────────────┘
                                           │
                                           ▼
                                  ┌───────────────────┐
                                  │  M7: Research     │
                                  │  Alignment &      │
                                  │  Perf Hardening   │
                                  │     (6 tasks)     │
                                  └───────────────────┘

Critical Path: M1 → M2 → M3 → M4 → M5 → M6 → M7
```

---

## Milestone Summary

### M1: Robot Agent Video Stream & Local Control (8 tasks)

**Goal:** Establish foundational robot agent with camera streaming and control API.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M1-001 | Design Robot Agent architecture | P0 | Robot Agent |
| M1-002 | Implement camera capture module | P0 | Robot Agent |
| M1-003 | Implement control API (drive, kvm_input, e_stop) | P0 | Robot Agent |
| M1-004 | Implement session token validation (local) | P1 | Robot Agent |
| M1-005 | Implement rate limiting enforcement | P1 | Robot Agent |
| M1-006 | Implement safe-state transitions & E-Stop | P0 | Robot Agent |
| M1-007 | Build unit tests for control commands | P1 | Robot Agent |
| M1-008 | Create offline test harness | P2 | Robot Agent |

### M2: Web Console & WebRTC Connection (10 tasks)

**Goal:** Create operator web interface with real-time video and control via WebRTC.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M2-001 | Design Web Console UI layout | P0 | Web Console |
| M2-002 | Implement video rendering component | P0 | Web Console |
| M2-003 | Implement control input handlers | P0 | Web Console |
| M2-004 | Implement WebRTC peer connection setup | P0 | Web Console |
| M2-005 | Implement ICE/STUN/TURN configuration | P1 | Web Console |
| M2-006 | Implement signaling endpoint | P0 | Gateway |
| M2-007 | Implement session state UI indicators | P1 | Web Console |
| M2-008 | Implement latency/health overlay | P2 | Web Console |
| M2-009 | Add DataChannel message routing | P0 | Robot Agent |
| M2-010 | Build E2E connectivity test suite | P1 | QA |

### M3: Gateway Policy & Capability Tokens (14 tasks)

**Goal:** Implement identity verification, policy engine, and capability token system.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M3-001 | Design Gateway architecture | P0 | Gateway |
| M3-002 | Implement DID resolver (did:key) | P0 | Gateway |
| M3-003 | Implement VC signature verification | P0 | Gateway |
| M3-004 | Implement local policy snapshot storage | P1 | Gateway |
| M3-005 | Implement policy evaluation engine | P0 | Gateway |
| M3-006 | Implement capability token schema & generation | P0 | Gateway |
| M3-007 | Implement token TTL/expiry tracking | P1 | Gateway |
| M3-008 | Implement token revocation mechanism | P1 | Gateway |
| M3-009 | Integrate Gateway with Signaling service | P1 | Gateway |
| M3-010 | Implement Robot Agent token validation | P0 | Robot Agent |
| M3-011 | Implement step-up auth placeholder (TOTP) | P3 | Gateway |
| M3-012 | Build policy evaluation test suite | P1 | QA |
| M3-013 | Add anomaly detection / rate limit bypass | P2 | Gateway |
| M3-014 | Set up VC Issuer (POC CA) | P1 | Gateway |

### M4: Ledger Integration & Audit Trail (12 tasks)

**Goal:** Integrate Hyperledger Fabric for immutable audit logging.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M4-001 | Set up Hyperledger Fabric test network | P0 | Ledger |
| M4-002 | Design chaincode for audit events | P0 | Ledger |
| M4-003 | Implement event schema | P0 | Ledger |
| M4-004 | Implement async event queue | P0 | Gateway |
| M4-005 | Implement backpressure + circuit breaker | P1 | Gateway |
| M4-006 | Integrate Gateway audit event publishing | P0 | Gateway |
| M4-007 | Implement Robot Agent audit publishing | P1 | Robot Agent |
| M4-008 | Implement ledger query API | P1 | Ledger |
| M4-009 | Implement event immutability verification | P1 | Ledger |
| M4-010 | Build ledger test suite | P1 | QA |
| M4-011 | Build integration test (control + ledger) | P1 | QA |
| M4-012 | Verify ledger writes don't block control | P0 | QA |

### M5: Revocation + Safe-Stop Integration (12 tasks)

**Goal:** Implement credential revocation with automatic safe-state transitions.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M5-001 | Implement admin revocation endpoint | P0 | Gateway |
| M5-002 | Implement token invalidation cache | P0 | Gateway |
| M5-003 | Implement session teardown (WebRTC close) | P0 | Gateway |
| M5-004 | Implement Robot Agent session termination | P0 | Robot Agent |
| M5-005 | Implement control-channel-loss detection | P0 | Robot Agent |
| M5-006 | Implement repeated-invalid-command detection | P1 | Robot Agent |
| M5-007 | Implement safe-state transition on trigger | P0 | Robot Agent |
| M5-008 | Implement revocation propagation measurement | P1 | Measurement |
| M5-009 | Implement operator UI revocation notification | P1 | Web Console |
| M5-010 | Add E-Stop override tests | P0 | QA |
| M5-011 | Build revocation scenario test suite | P1 | QA |
| M5-012 | Measure revocation latency | P1 | Measurement |

### M6: Measurement Harness & Report (12 tasks)

**Goal:** Build performance measurement infrastructure and validate NFR targets.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M6-001 | Implement session setup timer | P0 | Measurement |
| M6-002 | Implement control RTT measurement | P0 | Measurement |
| M6-003 | Implement video latency measurement | P0 | Measurement |
| M6-004 | Implement transport stats collection | P1 | Measurement |
| M6-005 | Implement metrics aggregation (p50, p95) | P1 | Measurement |
| M6-006 | Build automated test scenario runner | P1 | Measurement |
| M6-007 | Implement results export (JSON, CSV) | P2 | Measurement |
| M6-008 | Create HTML report template | P2 | Measurement |
| M6-009 | Run baseline measurement (LAN) | P0 | QA |
| M6-010 | Run WAN simulation test | P1 | QA |
| M6-011 | Validate NFR-P1 through NFR-P4 targets | P0 | QA |
| M6-012 | Create operator's measurement guide | P2 | Documentation |

### M7: Research Alignment & Performance Hardening (6 tasks)

**Goal:** Align the POC with research-backed latency, resilience, and topology insights.

| ID | Task | Priority | Component |
|----|------|----------|-----------|
| M7-001 | Implement hybrid topology (P2P control + relayed video) | P0 | Transport |
| M7-002 | Implement adaptive rate control + tail-latency guard | P0 | Robot Agent |
| M7-003 | Tune low-latency buffering strategy | P1 | Web Console |
| M7-004 | Implement ICE restart + network handover recovery | P1 | Transport |
| M7-005 | Improve control channel loss resilience | P1 | Transport |
| M7-006 | Produce market benchmark report | P2 | Measurement |

---

## Key Metrics (NFR Targets)

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| NFR-P1 | Session setup time | < 3 seconds | M6-001 |
| NFR-P2 | Control command RTT | < 100ms (p95) | M6-002 |
| NFR-P3 | Video latency | < 200ms (p95) | M6-003 |
| NFR-P4 | Control rate | ≥ 20 Hz | M6-004 |

---

## Getting Started

1. Start with P0 tasks in M1
2. Complete all P0 tasks before moving to next milestone
3. P1 tasks can be parallelized within a milestone
4. P2/P3 tasks can be deferred if timeline is tight

---

## Task Count Summary

| Milestone | Tasks | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|----|
| M1 | 8 | 4 | 3 | 1 | 0 |
| M2 | 10 | 5 | 4 | 1 | 0 |
| M3 | 14 | 5 | 6 | 1 | 2 |
| M4 | 12 | 5 | 6 | 0 | 1 |
| M5 | 12 | 5 | 6 | 0 | 1 |
| M6 | 12 | 4 | 5 | 3 | 0 |
| M7 | 6 | 2 | 3 | 1 | 0 |
| M6 | 12 | 4 | 4 | 4 | 0 |
| **Total** | **68** | **28** | **29** | **7** | **4** |
