# M4-003: Implement Event Schema

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Ledger
- **Priority:** P0
- **Status:** Todo

## User Story

As a developer, I want a well-defined event schema so that audit events are consistent and queryable.

## Requirements

### Functional Requirements
- FR-12: Events have consistent schema for storage and retrieval

### Non-Functional Requirements
- Schema supports future extensibility
- Efficient serialization

## Definition of Done

- [ ] Event schema definition (JSON Schema)
- [ ] Required fields specification
- [ ] Event type enumeration
- [ ] Timestamp format standardization
- [ ] Signature/hash fields
- [ ] Schema validation library
- [ ] Schema documentation
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Schema Validation
- **Preconditions:** Schema defined
- **Steps:**
  1. Create event matching schema
  2. Validate against schema
- **Expected Result:** Validation passes
- **Pass Criteria:** No validation errors

### Test Case 2: Invalid Event Rejection
- **Preconditions:** Schema defined
- **Steps:**
  1. Create event missing required fields
  2. Validate against schema
- **Expected Result:** Validation fails
- **Pass Criteria:** Clear error message

### Test Case 3: Event Types
- **Preconditions:** Event types defined
- **Steps:**
  1. Create SESSION_STARTED event
  2. Create PRIVILEGED_ACTION event (E_STOP, MODE_SWITCH)
  3. Create SESSION_ENDED event
- **Expected Result:** All types valid
- **Pass Criteria:** Schema accepts all types

**Note:** Per PRD Design Decision 16.3, minimal logging (SESSION_*, E_STOP, MODE_SWITCH) satisfies compliance without full command streams.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Schema too rigid | M | Design for extension |
| Serialization performance | L | Use efficient format |
| Version incompatibility | M | Schema versioning |

## Dependencies

- **Blocked by:** M4-001
- **Blocks:** M4-004, M4-006, M4-007
- **Related:** M4-002

## References

- PRD Section: 8.4 (Audit trail / blockchain - FR-12)
- PRD Section: 11.2 (Ledger event schema)
- Design Decision: 16.3 (Minimal logging)
- Design Decision: 16.34 (Schema Design)

## Open Questions

- JSON vs Protobuf for events?
- Required vs optional fields?

## Event Schema Draft

Per PRD Design Decision 16.3, the base schema logs minimal events to satisfy compliance without privacy/storage overhead of full command streams.

**Base Event Types (required):**
- SESSION_REQUESTED, SESSION_GRANTED, SESSION_STARTED, SESSION_ENDED, SESSION_REVOKED
- PRIVILEGED_ACTION (E_STOP, MODE_SWITCH)

**Optional Extension:** Hash-chained command logs may be enabled for enhanced auditing.

```json
{
  "eventId": "uuid",
  "eventType": "SESSION_REQUESTED|SESSION_GRANTED|SESSION_STARTED|SESSION_ENDED|SESSION_REVOKED|PRIVILEGED_ACTION",
  "timestamp": "ISO8601",
  "actorDID": "did:key:...",
  "resourceId": "robot-id",
  "sessionId": "uuid",
  "payload": {},
  "signature": "base64"
}
```
