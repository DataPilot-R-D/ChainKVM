# ChainKVM POC Architecture

This directory proposes an implementable architecture for the **ChainKVM Teleoperation POC** described in `PRD.md` and tracked in `roadmap/`.

## POC goals (from PRD)

- **Secure session establishment** with local policy evaluation and short-lived capability authorization.
- **Low-latency teleoperation** (video + keyboard/mouse/joystick-style control) with crypto/auth **not** in the real-time path.
- **Auditable session trail** with **asynchronous** permissioned-ledger writes.
- **Repeatable measurement** for setup time, control RTT, and video E2E latency.

## Architecture principles

- **Blockchain is off the control path.** The ledger never gates control messages; it only receives asynchronous audit events.
- **Gateway is the policy/authorization fast-path.** It verifies identity/credentials, evaluates policy, and issues capabilities.
- **Robot Agent enforces capabilities.** The robot accepts control only when a valid capability is presented and not revoked.
- **Safety is local.** E-stop and safe-stop triggers are enforced on the robot-side safety path.

## Components (POC)

- **Operator Web Console (browser)**
  - Requests sessions, renders video, sends control inputs.
  - Runs measurement probes (RTT pings, stats collection) and displays session state.
- **Policy + Session Gateway**
  - Identity verification (DID/VC), policy evaluation, capability token issuance.
  - Signaling endpoint for WebRTC (SDP/ICE relay), plus session lifecycle management.
  - Revocation endpoint and revocation propagation to active sessions.
  - Async audit queue and ledger publisher.
- **Robot Agent**
  - Captures/encodes video, establishes WebRTC with the console, receives control over DataChannel.
  - Validates capability token, rate limits, and triggers safe-state on violations or control loss.
  - Emits privileged-action audit events (and optionally additional telemetry).
- **Permissioned Ledger (Hyperledger Fabric)**
  - Stores a minimal session lifecycle and privileged-action event trail immutably.
- **VC Issuer (POC)**
  - Issues VCs for operator roles/permissions (may be a simple test issuer in POC).
- **RTC Infra**
  - STUN/TURN for NAT traversal; optional SFU/relay if direct P2P is not feasible.
- **Observability / Measurement**
  - Metrics store + aggregation + report output; scenario runner for repeatable tests.

## Diagrams (Mermaid)

Diagrams are stored as standalone Mermaid files under `docs/architecture/diagrams/`.

- [Component overview](diagrams/01-component-overview.mmd)
- [Session establishment sequence](diagrams/02-session-establishment-sequence.mmd)
- [Runtime dataflow](diagrams/03-runtime-dataflow.mmd)
- [Revocation sequence](diagrams/04-revocation-sequence.mmd)
- [Deployment topology](diagrams/05-deployment-topology.mmd)
- [Security trust boundaries](diagrams/06-security-trust-boundaries.mmd)
- [Observability & measurement](diagrams/07-observability-measurement.mmd)
- [Suggested stack](diagrams/08-stack.mmd)
- [Data model](diagrams/09-data-model.mmd)
- [Session state machine](diagrams/10-session-state-machine.mmd)
- [Robot safety state](diagrams/11-robot-safety-state.mmd)
- [Policy update subscription](diagrams/12-policy-update-subscription.mmd)
- [Audit queue + backpressure](diagrams/13-audit-queue-backpressure.mmd)
- [Revocation propagation timing](diagrams/14-revocation-propagation-timing.mmd)
- [Reconnect + resume](diagrams/15-reconnect-resume.mmd)

If your Markdown renderer doesn’t auto-render `.mmd`, open them in a Mermaid-aware viewer (e.g., VS Code Mermaid extension) or paste into Mermaid Live Editor.

## Primary flows

### 1) Start a teleoperation session

Reference: `docs/architecture/diagrams/02-session-establishment-sequence.mmd`

1. Console requests a session from Gateway with operator credential presentation (VC/VP).
2. Gateway verifies credential signature/issuer/expiry and evaluates local policy snapshot.
3. If allowed, Gateway issues a **short-lived capability token** bound to a `session_id` and scope.
4. Console and Robot Agent connect to Gateway signaling and exchange SDP/ICE.
5. Console and Robot Agent establish WebRTC; Console opens DataChannel.
6. Console presents capability token to Robot Agent (e.g., first DataChannel message); Robot validates before accepting control.
7. Gateway emits asynchronous audit events for session lifecycle (granted/started).

### 2) Runtime (video + control + safety)

Reference: `docs/architecture/diagrams/03-runtime-dataflow.mmd`

- **Video:** Robot → Console over SRTP.
- **Control:** Console → Robot over WebRTC DataChannel. Robot applies input validation and per-session rate limiting.
- **Safety triggers:** Robot transitions to safe-stop on E-stop, control channel loss, or invalid-command thresholds.

### 3) Revocation

Reference: `docs/architecture/diagrams/04-revocation-sequence.mmd`

- Admin revokes a session/operator via Gateway.
- Gateway updates revocation state, terminates the session (and prevents reconnect), and pushes termination to Robot/Console.
- Robot safe-stops and closes the connection; Gateway emits `SESSION_REVOKED` asynchronously to the ledger.

### 4) Audit trail (ledger)

- Gateway is the primary audit publisher for session lifecycle and privileged actions.
- Audit publishing uses an async queue with backpressure so ledger slowdowns never impact control latency.
- POC-minimum event types: `SESSION_REQUESTED`, `SESSION_GRANTED`, `SESSION_STARTED`, `SESSION_ENDED`, `SESSION_REVOKED`, `PRIVILEGED_ACTION` (e.g., `E_STOP`, `MODE_SWITCH`).

### 5) Measurement & reporting

Reference: `docs/architecture/diagrams/07-observability-measurement.mmd`

- Instrument session setup phases, control RTT (ping/pong), video latency (timestamp overlay), and transport stats (getStats).
- Aggregate into p50/p95/p99 and produce a repeatable report.

## Deployment topology (POC)

Reference: `docs/architecture/diagrams/05-deployment-topology.mmd`

- Run **Gateway** close to the robot network when possible (reduces signaling and authorization overhead).
- WebRTC prefers **direct P2P**; TURN is the fallback for NAT traversal.
- Ledger runs out-of-band; only async audit traffic reaches it.

## Roadmap alignment (high level)

- **Robot Agent:** M1-* (streaming/control/safety), M5-* (safe-stop integration), M4-007 (agent audit publishing)
- **Web Console & WebRTC:** M2-* (UI + WebRTC + DataChannel), M5-009 (revocation UX)
- **Gateway:** M3-* (identity/policy/tokens), M2-006/M3-009 (signaling), M4-004..M4-006 (async audit publishing), M5-001..M5-003 (revocation)
- **Ledger:** M4-001..M4-003/M4-008/M4-009
- **Measurement:** M6-001..M6-006 (plus follow-ups for export/report/baselines)

## Component Architecture

Detailed architecture documentation for each major component:

- [Gateway Architecture](gateway/README.md) - Policy, tokens, signaling
  - [Gateway API Reference](gateway/API.md)
  - [Gateway Data Flows](gateway/DATAFLOW.md)
- [Robot Agent Architecture](robot-agent/README.md) - Video, control, safety
  - [Robot Agent API](robot-agent/API.md)
  - [Robot Agent Data Flow](robot-agent/DATAFLOW.md)

More detailed interface and security notes:

- `INTERFACES.md`
- `SECURITY.md`
- `OBSERVABILITY.md`
- `POLICY.md`
- `AUDIT.md`
- `IDENTITY.md`
- `REVOCATION.md`
- `RELIABILITY.md`
- `ROADMAP.md`
- `CHECKLIST.md`
- `DECISIONS.md`
