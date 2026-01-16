# Architecture Completeness Checklist (POC)

This checklist maps PRD requirements to concrete architecture specs and diagrams in `docs/architecture/`.

## Functional requirements (FR)

| PRD item | Covered by | Notes |
|---|---|---|
| FR-1 DID identities | `docs/architecture/IDENTITY.md` | POC assumes `did:key` and fast local resolution. |
| FR-2 Verifiable credentials | `docs/architecture/SECURITY.md` `docs/architecture/IDENTITY.md` | Issuer trust configured at Gateway. |
| FR-3 Step-up auth (optional) | `docs/architecture/SECURITY.md` | Implement via scope-gating in tokens. |
| FR-4 Local policy evaluation | `docs/architecture/POLICY.md` | Deterministic ordered rules + policy hash. |
| FR-5 Capability token issuance | `docs/architecture/INTERFACES.md` `docs/architecture/IDENTITY.md` | JWT with `sid/aud/scope/exp/jti`. |
| FR-6 Token enforcement | `docs/architecture/INTERFACES.md` `docs/architecture/SECURITY.md` | Robot validates before accepting control. |
| FR-7 Revocation | `docs/architecture/REVOCATION.md` | Push revoke via signaling + robot safe-stop. |
| FR-8 Video streaming | `docs/architecture/README.md` `docs/architecture/diagrams/03-runtime-dataflow.mmd` | WebRTC SRTP. |
| FR-9 Control channel | `docs/architecture/INTERFACES.md` | DataChannel message schema + auth-first message. |
| FR-10 NAT traversal | `docs/architecture/diagrams/05-deployment-topology.mmd` | ICE with STUN/TURN fallback. |
| FR-11 Async ledger writes | `docs/architecture/AUDIT.md` | Queue + consumer; never block control. |
| FR-12 Minimum event schema | `docs/architecture/AUDIT.md` | SESSION_* + PRIVILEGED_ACTION. |
| FR-13 Subscriptions (optional) | `docs/architecture/POLICY.md` `docs/architecture/diagrams/12-policy-update-subscription.mmd` | For multi-gateway or external policy mgmt. |
| FR-14 Safety override | `docs/architecture/RELIABILITY.md` `docs/architecture/diagrams/11-robot-safety-state.mmd` | Safe-stop on estop/loss/invalid. |
| FR-15 Rate limiting | `docs/architecture/README.md` `docs/architecture/RELIABILITY.md` | Implemented robot-side per session/action. |

## Non-functional requirements (NFR)

| PRD item | Covered by | Notes |
|---|---|---|
| NFR-P1 Setup time | `docs/architecture/OBSERVABILITY.md` | Phase timers at Gateway/Console. |
| NFR-P2 Control RTT | `docs/architecture/OBSERVABILITY.md` | Ping/pong over DataChannel with monotonic time. |
| NFR-P3 Video latency | `docs/architecture/OBSERVABILITY.md` | Timestamp overlay at capture + extraction at console. |
| NFR-P4 Control rate | `docs/architecture/OBSERVABILITY.md` `docs/architecture/RELIABILITY.md` | Track Hz + drops; tune rate limits. |
| Reliability (reconnect/teardown) | `docs/architecture/RELIABILITY.md` `docs/architecture/diagrams/15-reconnect-resume.mmd` | Re-auth after reconnect; safe-stop on loss. |
| Privacy constraints | `docs/architecture/AUDIT.md` | Bounded metadata; no raw media on ledger. |

## Build-ready gaps to track explicitly

POC defaults are recorded in `docs/architecture/DECISIONS.md`.
