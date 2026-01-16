# Roadmap ↔ Architecture Mapping (POC)

This document maps the roadmap milestones/tasks to the proposed architecture so implementation can proceed bottom-up without losing PRD intent.

## Milestones to components

| Milestone | Architecture area | Primary artifacts |
|---|---|---|
| M1 | Robot Agent (video/control/safety) | WebRTC peer on robot, control handlers, safe-stop state machine |
| M2 | Web Console + WebRTC wiring | UI, signaling client, DataChannel control, session state UX |
| M3 | Gateway identity/policy/tokens | DID/VC verification, policy engine, capability tokens, session manager |
| M4 | Ledger integration + async audit | Event schema, async queue, Fabric client + chaincode + queries |
| M5 | Revocation + safe-stop integration | Admin revoke, token invalidation, teardown propagation, safety triggers |
| M6 | Measurement harness + reporting | setup timers, RTT/video latency, stats collection, aggregation, runner |

## Suggested implementation order (matches PRD milestones)

1. **Robot Agent local loop** (M1 P0): video capture + local control + safe-stop.
2. **Web Console + WebRTC P2P** (M2 P0): connect and control without identity/policy (development stub).
3. **Gateway capability issuance + validation** (M3 P0): add DID/VC, policy, and scoped session tokens.
4. **Ledger audit** (M4 P0): async audit publishing with queue/backpressure.
5. **Revocation** (M5 P0): termination propagation + safe-stop triggers + scenario tests.
6. **Measurement/reporting** (M6): instrumentation, aggregation, repeatable runner, exported report.

## Where each diagram fits

- `docs/architecture/diagrams/01-component-overview.mmd`: maps to M1–M6.
- `docs/architecture/diagrams/02-session-establishment-sequence.mmd`: M2–M3 with M4 audit side effects.
- `docs/architecture/diagrams/03-runtime-dataflow.mmd`: M1–M2 runtime + M4 audit + M6 metrics.
- `docs/architecture/diagrams/04-revocation-sequence.mmd`: M5.
- `docs/architecture/diagrams/05-deployment-topology.mmd`: deployment assumptions for all milestones.
- `docs/architecture/diagrams/06-security-trust-boundaries.mmd`: M3 authN/Z + M5 revocation + M4 audit integrity.
- `docs/architecture/diagrams/07-observability-measurement.mmd`: M6.
- `docs/architecture/diagrams/08-stack.mmd`: implementation choices across milestones.
- `docs/architecture/diagrams/10-session-state-machine.mmd`: session lifecycle driving M3/M5/M4 audit events.
- `docs/architecture/diagrams/11-robot-safety-state.mmd`: M1/M5 safety enforcement.

## Notes on current roadmap hygiene

- Several roadmap task files reference outdated PRD section numbers and non-existent “Design Decision” ids; treat them as placeholders until corrected.

