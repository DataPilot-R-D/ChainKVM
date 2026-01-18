# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChainKVM is a Proof of Concept for secure, auditable remote robot teleoperation using decentralized identity and blockchain audit trails. The system enables operators to remotely control robots via KVM-style interfaces (video + keyboard/mouse/joystick) with sub-second latency while producing tamper-evident audit logs.

**Key architectural principle:** Blockchain is never in the real-time control path. The ledger only receives asynchronous audit events.

## Architecture

### Components (POC)

- **Web Console** (TypeScript/React) - Operator UI for video viewing and control input
- **Gateway** (Node.js/TypeScript) - Policy evaluation, capability token issuance, signaling, and async audit publishing
- **Robot Agent** (Go/Pion WebRTC) - Video streaming, control execution, token validation, safety enforcement
- **Ledger** (Hyperledger Fabric/Go chaincode) - Immutable audit trail for session lifecycle and privileged actions

### Key Flows

1. **Session establishment:** Console → Gateway (VC verification + policy check) → Capability token issued → WebRTC P2P connection
2. **Runtime:** Video (Robot → Console via SRTP), Control (Console → Robot via DataChannel)
3. **Revocation:** Gateway invalidates tokens → pushes termination to both peers → Robot enters safe-stop
4. **Audit:** Gateway publishes events asynchronously to Fabric (never blocks control)

### Technology Decisions

- **Transport:** WebRTC-only (SRTP video + DataChannel control), TURN fallback for NAT
- **Identity:** did:key for POC, JWT-based VCs
- **Capability tokens:** JWT/JWS signed with Ed25519
- **Policy:** Ordered ABAC rules in JSON (first deny wins, else first allow, else default deny)

## Roadmap & Task Management

Tasks are tracked in `roadmap/` using a Kanban-style directory structure:

```
roadmap/todo/       - Pending tasks
roadmap/in_progress/ - Active tasks
roadmap/done/       - Completed tasks
```

**Task naming:** `M[milestone]-[3-digit]-[kebab-case-name].md` (e.g., `M1-001-robot-agent-architecture.md`)

**Milestones:**
- M1: Robot Agent (video streaming, control API, safety)
- M2: Web Console & WebRTC connection
- M3: Gateway (identity, policy, capability tokens)
- M4: Ledger integration (Hyperledger Fabric audit trail)
- M5: Revocation + safe-stop integration
- M6: Measurement harness & performance validation

**Priority levels:** P0 (critical path) > P1 (important) > P2 (nice to have) > P3 (optional)

## NFR Performance Targets

| Metric | LAN Target | WAN Target |
|--------|------------|------------|
| Session setup | p50 ≤ 2s, p95 ≤ 5s | p50 ≤ 5s, p95 ≤ 15s |
| Control RTT | p50 ≤ 50ms | p50 ≤ 150ms |
| Video latency | p50 ≤ 200ms | p50 ≤ 400ms |
| Control rate | ≥ 20 Hz sustained | ≥ 20 Hz sustained |
| Revocation latency | p95 ≤ 1s | p95 ≤ 2s |

## Code Standards

This project uses strict code quality thresholds:

| Metric | Max |
|--------|-----|
| File size | 250 LOC |
| Function size | 30 LOC |
| Cyclomatic complexity | 10 |

**Languages:** TypeScript, JavaScript, Python, Go

## Key Documentation

- `PRD.md` - Product requirements and functional specifications
- `docs/architecture/README.md` - Architecture overview with component diagrams
- `docs/architecture/DECISIONS.md` - Concrete implementation choices
- `docs/architecture/diagrams/` - Mermaid diagrams for all system flows
- `roadmap/README.md` - Task breakdown and milestone dependencies

## PRD Section Reference

When referencing PRD sections in task files:
- 7.1: POC scope (components)
- 8.1: Identity & authentication (FR-1, FR-2, FR-3)
- 8.2: Policy & authorization (FR-4, FR-5, FR-6, FR-7)
- 8.3: Media + control transport (FR-8, FR-9, FR-10)
- 8.4: Audit trail / blockchain (FR-11, FR-12, FR-13)
- 8.5: Safety & fail-safes (FR-14, FR-15)
- 9.1: Performance targets (NFR-P1 to NFR-P4)
- 10.1: High-level components
- 11.1-11.2: Data model (capability token, ledger event schemas)
- 12.1-12.2: Observability & measurement
- 16.x: Design decisions

## Agent Workflow

### CRITICAL: PR Review Process

**After creating a PR, you MUST:**
1. Run `/pr-review-toolkit:review-pr` to perform automated code review
2. Address any issues found by the review
3. If review passes, proceed to merge
4. If review fails, fix issues and re-run review

**Task is NOT complete until:**
- [ ] Automated PR review passes
- [ ] PR is merged to main
- [ ] Task file moved to `roadmap/done/`

### Task Execution Rules

1. **Single Task Focus**
   - Work on ONE task at a time
   - Complete fully before selecting next task

2. **Kanban Task Selection**
   - Do NOT follow sequential task numbering (001 → 002 → 003)
   - Select the most aligned task based on:
     - Dependencies resolved (check "Blocked by" in task file)
     - Priority (P0 > P1 > P2 > P3)
     - Current milestone progression
     - Context fit (skills, recent work)

3. **Test-Driven Development (TDD)**
   - Start every implementation with tests
   - Red → Green → Refactor cycle
   - No code without corresponding tests

4. **Definition of Done**

   **Phase 1: Implementation**
   - [ ] Tests written and passing (green)
   - [ ] Code refactored and clean
   - [ ] UAT scenarios from task file verified
   - [ ] Task-specific DoD checklist items completed
   - [ ] PR created

   **Phase 2: Automated Review**
   - [ ] Run `/pr-review-toolkit:review-pr`
   - [ ] All review checks pass
   - [ ] Fix any issues identified

   **Phase 3: Completion**
   - [ ] PR merged to main
   - [ ] Task file moved to `roadmap/done/`
   - [ ] Feature branch deleted

5. **Git Branch Workflow**
   - Branch naming: `feature/M#-###-task-name`
   - Commit format: Conventional Commits (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`)

   ```bash
   # 1. Start task - create feature branch
   git checkout -b feature/M1-001-task-name

   # 2. Move task to in_progress
   mv roadmap/todo/M1-001-task.md roadmap/in_progress/

   # 3. Implement with TDD (write tests first, then code)
   git add . && git commit -m "test(agent): add unit tests for control commands"
   git add . && git commit -m "feat(agent): implement control command handler"
   git add . && git commit -m "refactor(agent): extract validation logic"

   # 4. Create PR when implementation complete
   gh pr create --title "feat(agent): M1-001 task title" --body "..."

   # 4.5. Run automated PR review
   # Use: /pr-review-toolkit:review-pr
   # If issues found, fix them and re-run review
   # If review passes, proceed to merge

   # 5. Merge and cleanup
   gh pr merge --squash && git branch -d feature/M1-001-task-name

   # 6. Move task to done
   mv roadmap/in_progress/M1-001-task.md roadmap/done/
   git add roadmap/ && git commit -m "chore: move M1-001 task to done"
   ```

6. **Continuous Learning**
   Update CLAUDE.md when you discover:
   - Common mistakes and solutions
   - How to run/test specific components
   - Environment setup requirements
   - Non-obvious gotchas

7. **Living Documentation**
   - Update docs during implementation, not after
   - Keep architecture diagrams in sync
   - Update task dependencies if blockers found
