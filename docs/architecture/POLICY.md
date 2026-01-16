# Policy Model & Updates (POC)

This document makes the PRD policy requirements buildable by defining:

- a minimal policy data model and evaluation contract (FR-4)
- how policy snapshots are stored and versioned
- an event-driven update mechanism (FR-13, optional in PRD)

## Goals

- **Local, fast authorization:** evaluation should be deterministic and independent of the ledger.
- **Least privilege:** decisions produce explicit allowed actions and limits (rate limits, max control Hz).
- **Auditable:** decisions can be recorded with a stable `policy_hash` and reason codes.

## Data model

### Policy snapshot

A policy snapshot is the fully-evaluable policy set at a point in time.

Minimum fields:

- `policy_id`: stable identifier (e.g., `poc-default`)
- `version`: monotonically increasing integer
- `hash`: `sha256(canonical_json(snapshot_without_hash))` (recommend RFC 8785 JSON canonicalization)
- `rules`: ordered list of rules
- `default`: `deny`

Example (POC):

```json
{
  "policy_id": "poc-default",
  "version": 3,
  "hash": "sha256:…",
  "default": "deny",
  "rules": [
    {
      "id": "allow-teleop-operators",
      "effect": "allow",
      "when": {
        "actor.role": ["operator", "admin"],
        "resource.robot_id": ["robot-a"],
        "time.within": "09:00-17:00",
        "requested.scope": ["teleop:view", "teleop:control"]
      },
      "limits": {
        "control.max_hz": 30,
        "control.max_burst": 10
      }
    }
  ]
}
```

### Evaluation context

Context is built by the Gateway from the request and verified credentials.

Minimum context keys:

- `actor.did`
- `actor.role` (from VC/VP claims)
- `resource.robot_id`
- `requested.scope` (what the console asks for)
- `time.utc` (timestamp)

Optional context keys (POC-friendly):

- `client.ip`, `client.user_agent`
- `network.zone` (LAN/WAN tag for measurement)

## Evaluation contract

### Inputs

- `policy_snapshot`
- `context`

### Outputs

Minimum decision output:

- `decision`: `allow | deny`
- `effective_scope`: list of allowed actions (intersection of requested + allowed)
- `limits`: derived limits (e.g., `control.max_hz`)
- `reasons`: list of reason codes (for denies and auditing)
- `policy`: `{ policy_id, version, hash }`

Example output:

```json
{
  "decision": "allow",
  "effective_scope": ["teleop:view", "teleop:control", "teleop:estop"],
  "limits": { "control.max_hz": 30 },
  "reasons": [],
  "policy": { "policy_id": "poc-default", "version": 3, "hash": "sha256:…" }
}
```

### Determinism rules (important for auditing)

- Rules are evaluated **in order**; the first matching `deny` wins, else first matching `allow`.
- If no rules match: `default` applies.
- Matching logic must be pure (no network calls; no ledger calls).
- Canonical JSON + stable hashing must be used for `policy_hash`.

## Storage and versioning

For POC:

- Store snapshots as a JSON file or a single-row database record.
- Persist `{policy_id, version, hash, snapshot_json, updated_at}`.

Guidance:

- Always treat a policy update as creating a new immutable snapshot.
- Keep a bounded history for debugging and audit reproduction.

## Policy updates (FR-13, optional)

PRD describes “event-driven subscriptions” as optional. This becomes relevant when:

- multiple Gateway instances exist, or
- policy is managed externally (admin service/portal), or
- you want low-latency propagation without polling.

### Minimal mechanism

Reference: `docs/architecture/diagrams/12-policy-update-subscription.mmd`

- **Admin** writes a new policy snapshot (incremented version).
- Policy store persists it.
- A **Policy Update Publisher** emits `POLICY_UPDATED {policy_id, version, hash}` on an event channel.
- Each Gateway instance subscribes and hot-swaps its in-memory snapshot.

POC implementation options (pick one):

- **Single Gateway:** in-process event (no external bus needed).
- **Multi-Gateway (simple):** Redis Pub/Sub.
- **Multi-Gateway (robust):** NATS / Kafka with at-least-once delivery.

### Consistency model

- **New sessions** use the newest known snapshot immediately.
- **Active sessions** are not retroactively re-authorized by default (POC simplicity).
  - If you require “policy change kills active sessions”, implement as:
    - on policy update, compute impacted sessions and revoke them.

## Audit linkage

When the Gateway logs authorization decisions, include:

- `policy_id`, `policy_version`, `policy_hash`
- `decision` and `reasons[]`
- `requested_scope` and `effective_scope`

This enables later proof that a session was granted under a specific policy snapshot.
