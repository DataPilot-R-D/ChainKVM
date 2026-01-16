# Reliability & Session Lifecycle (POC)

This document specifies how the system behaves under disconnects, retries, and teardown.

## Session lifecycle states

Reference: `docs/architecture/diagrams/10-session-state-machine.mmd`

- `Requested` → `Granted` → `Signaling` → `Connected` → `Ended`
- `Revoked` is a terminal path to `Ended`.

## WebRTC reconnection (POC)

Goals:

- recover from transient network issues without creating a new session when possible
- avoid “zombie control” (control continuing after authorization is lost)

Recommended POC behavior:

- Console maintains signaling WS and uses ICE restart / renegotiation if needed.
- After DataChannel reconnect, Console re-sends `auth {sid, token}`.
- Robot Agent transitions to safe-stop on control loss, but can resume once:
  - DataChannel is re-established
  - authorization succeeds
  - operator resumes sending control

## Control loss timeout (robot safety trigger)

Robot Agent should enter safe-stop when:

- DataChannel closed, OR
- no valid control messages received for `CONTROL_LOSS_TIMEOUT_MS` (configurable)

POC default suggestion: `CONTROL_LOSS_TIMEOUT_MS = 500ms` (tune per robot dynamics).

## Clean teardown

Teardown sources:

- operator ends session
- admin revokes session
- unrecoverable transport error

Required effects:

- Robot safe-stops if control authorization ends.
- Gateway emits `SESSION_ENDED` / `SESSION_REVOKED` appropriately (async).
- Console UI reflects final state and blocks control inputs after end.

