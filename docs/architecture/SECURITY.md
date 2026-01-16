# Security Architecture (POC)

This document summarizes the security model implied by `PRD.md` and how the proposed architecture enforces it without adding latency to the real-time control path.

## Trust boundaries

Reference: `docs/architecture/diagrams/06-security-trust-boundaries.mmd`

- **Untrusted:** operator browser/client device.
- **Trusted edge:** Gateway (policy enforcement point, token issuer, audit publisher).
- **Robot domain:** Robot Agent + local safety path.
- **Ledger domain:** Fabric network (immutability/audit; not real-time).

## Identity & credentials

- **DIDs:** Operator and Robot each have a DID (POC: `did:key`; production-ready: `did:web`-friendly).
- **VCs:** Operator presents a VC/VP asserting role/permissions; Gateway verifies signature, expiry, and issuer trust.
- **Issuer trust:** Gateway maintains a configuration of trusted issuers for POC.

## Step-up authentication (optional)

PRD treats step-up (e.g., TOTP) as optional. If implemented:

- Gateway requires step-up before granting high-risk scopes (e.g., `teleop:estop_release`, `teleop:mode_switch`).
- Step-up proof should be time-bound and session-bound (short TTL, tied to `sid`).
- Robot Agent can enforce by checking the granted token `scope` (simplest) rather than validating TOTP directly.

## Authorization: capability tokens

- Gateway issues **short-lived** capability tokens (JWT) with:
  - least-privilege `scope`
  - binding to `session_id` (`sid`) and a random `nonce`
  - short TTL (`exp`) to limit replay window
- Robot Agent enforces authorization by validating:
  - JWT signature (Gateway public key)
  - expiry and session binding
  - scope for each control message

## Revocation model

- **Immediate revocation:** Admin triggers revoke at Gateway; Gateway terminates active sessions and pushes termination to Robot Agent and Web Console.
- **Propagation:** Prefer push-based revocation for active sessions; also rely on short TTL as a safety net.
- **Session binding:** If a token is replayed in a different session context, Robot Agent rejects it.

## Transport security

- **WebRTC:** DTLS-SRTP for media, DTLS/SCTP for DataChannel; encryption is end-to-end between peers.
- **Signaling:** Always authenticated; treat signaling as control-plane (do not trust signaling alone for authorization).

## Audit integrity (ledger)

- Ledger writes are **asynchronous** to avoid blocking control.
- Store minimal session lifecycle and privileged actions (POC); keep metadata bounded to avoid privacy/storage blowups.
- Optional extension: hash-chained command logs (not required for POC success criteria).

## Abuse prevention (POC)

- Robot-side rate limiting and anomaly thresholds.
- Safe-state transitions on control loss, invalid messages, or explicit E-stop.
- Gateway-side request throttling and signaling connection limits.
