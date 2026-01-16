# Audit Trail & Ledger Contract (POC)

This document makes the PRD audit requirements buildable by defining:

- the minimal event model (FR-12)
- asynchronous publishing with backpressure (FR-11)
- a simple ledger/chaincode contract and query surfaces

## Principles (from PRD)

- Ledger writes must **never** block the control path.
- Log **session lifecycle + privileged actions** (minimal logging for POC).
- Keep metadata bounded; do not store raw media.

## Event model (canonical)

### Common fields

All events share:

- `schema_version` (e.g., `1`)
- `event_id` (uuid)
- `timestamp` (ISO-8601 UTC)
- `robot_id`
- `operator_did` (may be absent for unauthenticated requests; use `unknown`)
- `session_id`
- `event_type`
- `metadata` (bounded JSON object; recommended limit: 4KB)

### Event types (POC minimum)

- `SESSION_REQUESTED`
  - `metadata`: `{ requested_scope, client_fingerprint? }`
- `SESSION_GRANTED`
  - `metadata`: `{ effective_scope, policy_id, policy_version, policy_hash, decision_reasons? }`
- `SESSION_STARTED`
  - `metadata`: `{ transport: "webrtc", topology: "p2p|turn|sfu"? }`
- `SESSION_ENDED`
  - `metadata`: `{ reason: "normal|disconnect|error|revoked" }`
- `SESSION_REVOKED`
  - `metadata`: `{ reason, revoked_by: "admin|policy_update|system" }`
- `PRIVILEGED_ACTION`
  - `metadata`: `{ action: "E_STOP|MODE_SWITCH|…", source: "operator|robot|system", details? }`

### Explicit non-goal (default)

Do **not** log per-command events (e.g., `command_executed`) in the default POC audit trail. If you later add command logs, prefer hashes/aggregates as described in PRD privacy notes.

## Asynchronous publishing

Reference: `docs/architecture/diagrams/13-audit-queue-backpressure.mmd`

### Gateway responsibilities

- Emit audit events on session lifecycle transitions and privileged actions.
- Enqueue events to an async queue immediately (sub-millisecond target on hot path).
- A background consumer publishes to Fabric and records success/failure.

### Queue requirements (POC)

- Durable enough to survive process crash for critical events (SESSION_* and PRIVILEGED_ACTION).
  - POC option: append-only local spool file + in-memory index.
- Backpressure strategy when ledger is slow/unavailable:
  - Never block control.
  - Prefer to **drop/aggregate non-critical** events first (avoid adding those to the ledger stream in POC).
  - For critical events, keep bounded buffering and alert when limits exceeded.

### Observability

Expose queue metrics:

- queue depth, oldest event age
- publish success rate, retry counts
- circuit breaker open/close state

## Fabric / chaincode contract (minimal)

This is a conceptual contract; actual Fabric SDK and chaincode language can vary.

### Chaincode functions

- `PutEvent(event_json)`
  - Validates `schema_version`, required fields, metadata size bounds.
  - Stores by `event_id` and indexes by `session_id` and `timestamp`.
- `QueryEvents(filter_json)`
  - Filters: `session_id`, `robot_id`, `operator_did`, `event_type`, `from_ts`, `to_ts`, `page`, `page_size`.

### Query expectations

- Pagination is required.
- Query should support “get all events for a session in order”.

## Storage/indexing (POC decision)

To avoid requiring CouchDB in a POC, use composite keys (LevelDB-friendly):

- Primary: `event:{event_id}` → full event JSON
- By session (ordered): `sess:{session_id}:{timestamp}:{event_id}` → `event_id`
- By time (optional global): `ts:{timestamp}:{event_id}` → `event_id`
- By actor (optional): `actor:{operator_did}:{timestamp}:{event_id}` → `event_id`

## Gateway audit query API

The Gateway exposes a query API that maps to `QueryEvents` and enforces authorization:

- auditors/admins can query by robot/session/operator and time range
- operators can query their own sessions (optional)

Suggested REST surface: see `docs/architecture/INTERFACES.md`.
