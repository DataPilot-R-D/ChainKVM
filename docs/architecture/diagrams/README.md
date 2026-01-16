# Mermaid Diagrams

These `.mmd` files contain Mermaid diagrams referenced by `docs/architecture/README.md`.

If your Markdown renderer doesn’t auto-render `.mmd`, open files in a Mermaid-aware viewer (VS Code Mermaid extension) or paste into Mermaid Live Editor.

## Index

- `docs/architecture/diagrams/01-component-overview.mmd` — system components and connections
- `docs/architecture/diagrams/02-session-establishment-sequence.mmd` — session start sequence with auth + signaling + audit
- `docs/architecture/diagrams/03-runtime-dataflow.mmd` — steady-state video/control + audit + metrics flows
- `docs/architecture/diagrams/04-revocation-sequence.mmd` — admin revoke propagation to robot/console + audit
- `docs/architecture/diagrams/05-deployment-topology.mmd` — POC deployment zones (operator/edge/robot/ledger) + STUN/TURN
- `docs/architecture/diagrams/06-security-trust-boundaries.mmd` — trust boundaries and crypto artifacts
- `docs/architecture/diagrams/07-observability-measurement.mmd` — metric sources → store → aggregation → report
- `docs/architecture/diagrams/08-stack.mmd` — suggested implementation stack by component
- `docs/architecture/diagrams/09-data-model.mmd` — token/event/metric core schemas (conceptual)
- `docs/architecture/diagrams/10-session-state-machine.mmd` — session lifecycle states
- `docs/architecture/diagrams/11-robot-safety-state.mmd` — robot safety state transitions
- `docs/architecture/diagrams/12-policy-update-subscription.mmd` — event-driven policy update propagation (FR-13)
- `docs/architecture/diagrams/13-audit-queue-backpressure.mmd` — async audit publishing with resilience
- `docs/architecture/diagrams/14-revocation-propagation-timing.mmd` — revoke → safe-stop timing and measurement points
- `docs/architecture/diagrams/15-reconnect-resume.mmd` — reconnection and re-auth after transient loss
