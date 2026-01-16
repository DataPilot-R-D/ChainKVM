# PRD — ChainKVM Teleoperation (POC)

**Document status:** Draft (POC PRD)

**Last updated:** 2026-01-16

**Product / Working name:** ChainKVM Teleoperation

**One-liner:** Secure, auditable remote robot operation over “KVM-adjacent” interfaces (video + keyboard/mouse/joystick control) using fast-path capability authorization and asynchronous blockchain logging.

---

## 1. Context

Recent research across teleoperation, low-latency streaming, and blockchain access control converges on a consistent architectural conclusion: **blockchain should not sit in the real-time control loop**. Instead, the fastest workable pattern is:

1) **Fast-path local authorization** (gateway validates identity/policy and issues a short-lived capability + session key)
2) **Real-time media/control over low-latency transports** (WebRTC/QUIC-like)
3) **Asynchronous blockchain audit/endorsement** (ledger records access + key actions for non-repudiation / compliance)
4) **Shadow policy state** at gateways/validators so authorization does not require chain replay

This PRD defines a Proof of Concept that implements the above pattern end-to-end for **one robot + one operator** with measurable latency and an auditable session trail.

---

## 2. Problem statement

Remote robot operation is needed for:

- Teleoperation / interventions when autonomy fails
- Remote maintenance, debugging, and “operator assist”
- Cross-organization operations (OEM ↔ integrator ↔ customer site) where trust boundaries matter

However, most remote access stacks are either:

- **Too centralized and brittle** (VPN + shared credentials + weak audit)
- **Not latency-aware** (security controls accidentally add jitter/latency)
- **Hard to govern** across organizations (who can access which robot, when, and what they did)

We need a system that can grant time-bound, least-privilege remote control **without sacrificing latency**, while producing a tamper-evident audit trail.

---

## 3. POC goals

### 3.1 Primary goals (must prove)

1. **Secure session establishment**
   - Operator requests access to a robot; access is granted only if policy permits.
   - Session access is time-bound and revocable.

2. **Low-latency remote operation**
   - Operator can view robot video and send control inputs (keyboard/mouse/joystick commands).
   - Security/auth layers must not sit on the real-time path.

3. **Auditable operations**
   - Session start/stop and privileged actions are written to a permissioned ledger.
   - Audit writes are asynchronous so the control loop is unaffected.

4. **Measurable performance**
   - POC includes repeatable measurement for session setup time, control RTT, and video E2E latency.

### 3.2 Secondary goals (nice to have)

- “Read-only observer” role (view video, no control)
- Step-up auth (e.g., TOTP) for high-risk actions (e-stop release, mode switch)
- Policy update propagation using event-driven subscriptions

---

## 4. Non-goals (explicitly out of scope for the POC)

- On-chain validation in the control loop (no “blockchain-per-command”)
- Multi-robot fleet management UI
- Full autonomy stack / navigation policies
- Advanced privacy features (ZK proofs, unlinkability)
- Hardware-embedded attestation (TPM/TEE) beyond basic key storage
- Hard real-time guarantees (POC focuses on measurement, not certification)

---

## 5. Users & personas

### 5.1 Operator

- Needs: responsive control + clear session state + safe stop
- Risks: credentials leak, device compromise, accidental misuse

### 5.2 Robot owner / Site admin

- Needs: policy control (who/when/what), emergency revoke, audit trail

### 5.3 Security / Compliance auditor

- Needs: tamper-evident log of remote sessions and privileged actions

### 5.4 Integrator / OEM support

- Needs: time-bound access across org boundary without VPN sprawl

---

## 6. Core user journeys

### 6.1 Start a teleoperation session (operator)

1. Operator opens the web console.
2. Operator selects Robot A.
3. Operator authenticates (SSO or local identity for POC).
4. Operator presents a verifiable credential (VC) asserting role/permission.
5. Gateway evaluates policy locally and (if allowed) issues:
   - Short-lived capability token (TTL minutes)
   - Session key material
6. Client establishes media/control session (WebRTC) using the token.
7. Ledger asynchronously records `SESSION_GRANTED` and `SESSION_STARTED`.

### 6.2 Revoke access (site admin)

1. Admin revokes operator access (policy change or manual kill).
2. Gateway invalidates tokens and tears down active sessions.
3. Ledger records `SESSION_REVOKED`.

### 6.3 Emergency stop (operator)

1. Operator triggers E-Stop.
2. Robot enters safe stop state immediately (local safety path).
3. Ledger records `E_STOP` event (async).

---

## 7. POC scope

### 7.1 What the POC will include

**A. Robot-side runtime (Robot Agent)**

- Captures camera video (or sim camera)
- Executes a minimal control API:
  - `drive(v, w)` for mobile base OR
  - `kvm_input(key/mouse/joy)` for KVM-style events
  - `e_stop()`
- Enforces session tokens and rate limits

**B. Edge/Gateway service (Policy + Session Gateway)**

- Validates operator identity credentials (DID/VC)
- Evaluates local policy snapshot
- Issues short-lived capabilities (token + session key)
- Runs a signaling service and/or integrates with one
- Writes audit events to ledger asynchronously

**C. Operator UI (Web Console)**

- Live video
- Control input (keyboard/mouse or joystick)
- Session state indicators (connected / authorized / revoked)
- Basic latency/health overlay (RTT, bitrate)

**D. Permissioned ledger (Audit chain)**

- Records session lifecycle events and privileged actions
- Exposes query API for audit retrieval

**E. Measurement harness**

- Session setup time
- Control RTT distribution
- Video end-to-end latency (timestamp overlay)
- Basic loss/jitter metrics from transport stats

### 7.2 What the POC will NOT include

- Full KVM for BIOS/firmware-level access
- Complex role hierarchies across many orgs
- Multi-party conferencing features (beyond 1 operator + 1 robot)

---

## 8. Functional requirements

### 8.1 Identity & authentication

**FR-1: DID-based identities (operator + robot)**

- Operator and robot each have a DID.
- For POC, DID method can be simplified (e.g., did:key or did:web).

**FR-2: Verifiable credentials for authorization**

- Operator presents a VC containing:
  - Operator DID
  - Role/permission claims (e.g., `teleop:drive`, `teleop:view`, `teleop:estop`)
  - Expiry
  - Issuer signature

**FR-3: Step-up authentication (optional)**

- For privileged actions, gateway can require a second factor (TOTP).

### 8.2 Policy & authorization

**FR-4: Local policy evaluation**

- Gateway must make an allow/deny decision without waiting for blockchain confirmation.

**FR-5: Capability token issuance**

- If authorized, gateway issues a capability token with:
  - TTL (minutes)
  - Robot ID
  - Allowed actions
  - Session binding (nonce / session ID)

**FR-6: Token enforcement**

- Robot Agent accepts control only if token is valid and not revoked.

**FR-7: Revocation**

- Admin can revoke a session; gateway terminates it.
- Token revocation must take effect quickly (see NFR latency).

### 8.3 Media + control transport

**FR-8: Real-time video streaming**

- Stream robot video to operator.
- Transport option for POC: WebRTC (SRTP).

**FR-9: Real-time control channel**

- Control messages sent over low-latency data channel.
- Recommended POC path: WebRTC DataChannel (SCTP/DTLS).

**FR-10: NAT traversal + relay fallback**

- Use ICE with STUN and TURN fallback.
- POC must track setup latency separately from steady-state RTT.

### 8.4 Audit trail (blockchain)

**FR-11: Asynchronous ledger writes**

- Ledger writes must never block control message delivery.

**FR-12: Minimum event schema**

- `SESSION_REQUESTED`
- `SESSION_GRANTED` (includes policy decision metadata)
- `SESSION_STARTED`
- `SESSION_ENDED`
- `SESSION_REVOKED`
- `PRIVILEGED_ACTION` (e.g., `E_STOP`, `MODE_SWITCH`)

**FR-13: Event-driven subscriptions (optional)**

- Gateway subscribes to policy updates via events rather than polling.

### 8.5 Safety & fail-safes

**FR-14: Local safety override**

- Robot must enter safe state on:
  - explicit E-Stop
  - control channel loss beyond threshold
  - repeated invalid control commands

**FR-15: Rate limiting**

- Control messages are rate-limited (per action type).

---

## 9. Non-functional requirements

### 9.1 Performance targets (POC)

Because operator-perceived latency is dominated by the media pipeline and topology, the POC sets separate targets for **LAN** vs **WAN**.

**NFR-P1: Session setup time (authorization + transport establishment)**

- LAN: p50 ≤ 2s, p95 ≤ 5s
- WAN/NAT: p50 ≤ 5s, p95 ≤ 15s

**NFR-P2: Control round-trip time (RTT) over the control channel**

- LAN: p50 ≤ 50ms
- WAN: p50 ≤ 150ms

**NFR-P3: Video latency**

- LAN: p50 ≤ 200ms (screen-to-screen)
- WAN: p50 ≤ 400ms (screen-to-screen)

**NFR-P4: Control rate**

- Sustain ≥ 20 Hz control messages without drops under stable network.

> Note: targets are intentionally framed as “POC feasibility bounds”, not production SLAs.

### 9.2 Reliability

- Automatic reconnection for transient transport failures
- Clean session teardown on revoke

### 9.3 Security

**Threats considered (POC)**

- Unauthorized operator attempts
- Token replay
- Stolen operator credential
- Malicious/compromised operator client
- MITM during signaling

**Controls (POC)**

- Short-lived, least-privilege capability tokens
- Transport encryption (DTLS-SRTP)
- Token binding to session + nonce
- Server-side rate limiting and anomaly thresholds
- Audit log immutability via permissioned blockchain

### 9.4 Privacy

- Store minimal necessary session metadata on ledger
- Do not store raw video/audio on ledger
- If command logs are stored, store hashes or aggregates by default

---

## 10. System architecture (POC)

### 10.1 High-level components

- **Operator Web Console** (browser)
- **Signaling / Session Orchestrator**
- **(Optional) SFU/Relay** for video
- **Policy + Session Gateway** (edge)
- **Robot Agent** (robot or robot-adjacent compute)
- **Permissioned Ledger Network** (audit)
- **VC Issuer** (POC CA / issuer)
- **Monitoring / Metrics**

### 10.2 Reference flow (session)

1. Operator requests session → Gateway
2. Operator presents VC → Gateway verifies signature/expiry
3. Gateway evaluates policy snapshot → allow/deny
4. If allow: Gateway issues capability token + session params
5. Operator establishes WebRTC connection
6. Real-time:
   - Video: Robot → Operator
   - Control: Operator → Robot (DataChannel)
7. Async audit events: Gateway → Ledger

### 10.3 Suggested POC topology

- Video path: WebRTC (direct if possible; SFU/TURN relay fallback)
- Control path: WebRTC DataChannel (direct P2P preferred)
- Ledger: Hyperledger Fabric (or equivalent permissioned ledger) for audit events

---

## 11. Data model

### 11.1 Capability token (example fields)

- `sub`: Operator DID
- `aud`: Robot ID
- `sid`: Session ID
- `scope`: Allowed actions list
- `exp`: Expiry timestamp
- `nonce`: Random
- `sig`: Gateway signature

### 11.2 Ledger event schema (minimum)

- `event_id`
- `timestamp`
- `robot_id`
- `operator_did`
- `session_id`
- `event_type`
- `policy_hash` (optional)
- `metadata` (bounded size)

---

## 12. Observability & measurement

### 12.1 Metrics to collect

- Session setup duration (auth time, ICE time)
- Control RTT (ping/pong over DataChannel)
- Video E2E latency (timestamp overlay)
- Bitrate, packet loss, jitter (transport stats)
- Revocation propagation delay

### 12.2 Measurement methods

- **Control RTT:** periodic ping/pong with monotonic timestamps.
- **Video latency:** overlay server timestamp on video frames; client compares to local time (requires clock sync or relative deltas).
- **S2S sanity check:** optional external “timer-in-frame” method for spot verification.

---

## 13. Acceptance criteria (POC exit)

The POC is considered successful when all are true:

1. An authorized operator can start a session and drive/issue control while viewing video.
2. An unauthorized operator is denied (no media/control session established).
3. Revocation terminates an active session and blocks further control.
4. Ledger contains a complete session lifecycle trail.
5. Measurement harness produces latency distributions and can be repeated.

---

## 14. Risks & mitigations

### R1: Session setup time dominates perceived performance
- **Mitigation:** pre-warm connections; measure setup separately; enable TURN fallback.

### R2: Tail latency spikes break safe teleoperation
- **Mitigation:** implement rate control / frame dropping; enforce safe-stop on stale control.

### R3: Ledger integration accidentally blocks the control path
- **Mitigation:** strict async queueing; circuit breaker; backpressure that drops audit events before impacting control.

### R4: Credential issuance/governance unclear in multi-org deployments
- **Mitigation:** keep VC issuer simple in POC; document future federation model.

---

## 15. Milestones (deliverable order, no time estimates)

1. Robot Agent can stream video and accept control locally.
2. Web Console can connect and control via WebRTC.
3. Gateway issues/validates capability tokens.
4. Ledger logs session lifecycle events.
5. Revocation + safe-stop integrated.
6. Measurement harness + report output.

---

## 16. Design decisions (resolved from open questions)

### 16.1 Ledger: Hyperledger Fabric
Fabric selected for POC due to native permissioning, channel-based isolation, and alignment with audit-focused requirements. State-channel/EVM alignment can be revisited post-POC if cross-chain interoperability becomes a priority.

### 16.2 Identity: did:key (POC), did:web-ready
did:key minimizes infrastructure for POC while VC schema remains DID-method agnostic. Transition to did:web for organizational anchoring in production.

### 16.3 Audit granularity: Session lifecycle + privileged actions
Minimal logging (SESSION_*, E_STOP, MODE_SWITCH) satisfies compliance audit requirements without privacy/storage overhead of full command streams. Hash-chained command logs available as opt-in extension.

### 16.4 Control interface: KVM-style (keyboard/mouse/joystick)
KVM-style input is primary, with `drive(v, w)` as convenience wrapper for mobile-base robots. Aligns with "ChainKVM" product positioning and maximizes applicability across robot types.

### 16.5 Transport: WebRTC-only (POC)
WebRTC selected for POC (video: SRTP, control: DataChannel/SCTP). QUIC/RoQ considered post-POC when browser ecosystem matures and if multi-camera scenarios require it.

---

## 17. Appendix — Source basis for this PRD

This PRD is derived from the provided research run and its requirements definition.

- Research report: `research-report.md`
- Research requirements definition: `rrd.json`

