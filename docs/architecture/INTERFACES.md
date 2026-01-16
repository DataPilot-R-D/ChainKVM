# Interfaces (Proposed)

This document sketches the key API and protocol surfaces implied by `PRD.md` and the roadmap milestones. It is intentionally minimal and POC-oriented.

## Gateway APIs

### Session management

- `POST /v1/sessions`
  - Request a teleoperation session.
  - Body (example): `{ robot_id, operator_did, vc_or_vp, requested_scope }`
  - Returns: `{ session_id, capability_token, signaling_url, ice_servers, expires_at, effective_scope, limits, policy }`
- `GET /v1/sessions/:session_id`
  - Returns session state for UI indicators.
- `DELETE /v1/sessions/:session_id`
  - Operator-initiated teardown (optional; admin revoke is separate).

### Revocation (admin)

- `POST /v1/revocations`
  - Body: `{ session_id | operator_did, reason }`
  - Side effects:
    - Updates revocation cache / invalidation set
    - Tears down active sessions
    - Emits `SESSION_REVOKED` audit event (async)

### Audit query (for auditor/admin)

- `GET /v1/audit/events`
  - Filters (example): `?session_id=&robot_id=&actor_did=&event_type=&from=&to=&page=&page_size=`
  - Returns: list of normalized audit events from the ledger query layer.

### Health/ops

- `GET /v1/health` / `GET /v1/ready`
- `GET /v1/metrics` (optional; or use OpenTelemetry/Prometheus exporters)
- `GET /.well-known/jwks.json` (Gateway token verification keys)

## Signaling (WebSocket)

Single WS endpoint is sufficient for POC (e.g., `/v1/signal`).

### Authentication

- Client connects with `Authorization: Bearer <capability_token>` (or a derived signaling token).
- Gateway authorizes room/join based on token `sid`, `aud` (robot), and scope.

### Message types (example)

- `join`: `{ type: "join", session_id, role: "operator" | "robot" }`
- `offer` / `answer`: `{ type: "offer"|"answer", session_id, sdp }`
- `ice`: `{ type: "ice", session_id, candidate }`
- `leave`: `{ type: "leave", session_id }`
- `session_state`: `{ type: "session_state", session_id, state }`
- `revoked`: `{ type: "revoked", session_id, reason }`

## WebRTC DataChannel (Control + Measurement)

### First message: capability authorization

- `auth`: `{ type: "auth", session_id, capability_token }`
- `auth_ok` / `auth_err`: `{ type: "auth_ok" }` or `{ type: "auth_err", reason }`

### Control messages (example schema)

- `drive`: `{ type: "drive", v, w, t }`
- `kvm_key`: `{ type: "kvm_key", key, action, t }`
- `kvm_mouse`: `{ type: "kvm_mouse", dx, dy, buttons, t }`
- `e_stop`: `{ type: "e_stop", t }`

### Measurement messages

- `ping`: `{ type: "ping", seq, t_mono }`
- `pong`: `{ type: "pong", seq, t_mono }`

## Capability token (JWT) – minimum fields

Suggested claims (aligned with PRD examples):

- `sub`: operator DID
- `aud`: robot ID
- `sid`: session ID
- `scope`: allowed actions (e.g., `teleop:view`, `teleop:control`, `teleop:estop`)
- `exp`: expiry
- `nonce`: random/session binding
- `jti`: token id (useful for revocation sets)

## Audit event schema (normalized)

Event types should minimally support:

- `SESSION_REQUESTED`
- `SESSION_GRANTED` (include policy decision metadata)
- `SESSION_STARTED`
- `SESSION_ENDED`
- `SESSION_REVOKED`
- `PRIVILEGED_ACTION` with `action: E_STOP | MODE_SWITCH | ...`

Common fields:

- `event_id`, `timestamp`
- `robot_id`, `operator_did`, `session_id`
- `event_type`
- `metadata` (bounded size; include policy hash/version if available)
