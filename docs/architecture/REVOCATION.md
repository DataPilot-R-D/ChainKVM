# Revocation & Reconnection Semantics (POC)

This document turns PRD revocation + reliability requirements into concrete, testable behavior.

## Revocation goals

- Revoke access quickly (terminate active session and block further control).
- Prevent reconnect loops after revocation.
- Ensure robot enters safe state when control is no longer authorized.

Reference: `docs/architecture/diagrams/14-revocation-propagation-timing.mmd`

## Revocation data model (Gateway)

Maintain a revocation store with two primary indices:

- `revoked_sessions`: keyed by `session_id` (`sid`)
- `revoked_tokens`: keyed by token `jti` (optional but useful)
- optional: `revoked_operators`: keyed by operator DID (bulk revoke)

Entries include `{ revoked_at, reason, revoked_by }`.

## Revocation flow (active session)

1. Admin calls `POST /v1/revocations`.
2. Gateway updates revocation state immediately.
3. Gateway signals **both peers** (Console + Robot Agent) via signaling WS:
   - `revoked { session_id, reason }`
4. Robot Agent transitions to safe-stop and closes the PeerConnection.
5. Console updates UI state and blocks further control UI.
6. Gateway asynchronously emits `SESSION_REVOKED` to the ledger.

### Race handling (important)

- Robot Agent must treat `revoked_sessions` as authoritative:
  - once revoked, reject any control messages for that `sid` even if they were in-flight.
- If the robot doesn’t receive the revoke message (network partition), safety still triggers:
  - control channel loss timeout → safe-stop
  - token expiry (short TTL) reduces replay window

## Reconnection behavior (PRD reliability)

PRD calls for automatic reconnection for transient failures. For POC:

- **Transient network loss:** Console attempts ICE restart / reconnect.
- **Re-auth required:** when DataChannel re-opens, Console must send `auth` again.
- **Gateway stays out of the hot path:** reconnection uses signaling WS; does not require ledger.

Reference: `docs/architecture/diagrams/15-reconnect-resume.mmd`

## Reconnect prevention after revoke

Once revoked:

- Gateway denies signaling joins for the revoked session.
- Robot Agent rejects `auth` for revoked `sid`/`jti` even if the DataChannel reappears briefly.
- Console must request a **new** session; policy may deny.

## Timing and measurement

Measure:

- admin revoke request accepted → robot safe-stop entered
- admin revoke request accepted → console control disabled

This ties directly to PRD’s “revocation must take effect quickly” and measurement goals.

