# M3-004: Implement Local Policy Snapshot Storage

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P1
- **Status:** Todo

## User Story

As a gateway administrator, I want policies stored locally so that policy evaluation is fast and available even during network issues.

## Requirements

### Functional Requirements
- FR-4: Store policy snapshots locally for fast evaluation

### Non-Functional Requirements
- Policy retrieval < 5ms
- Support 1000+ policies

## Definition of Done

- [ ] Policy schema definition
- [ ] Local storage mechanism (file/embedded DB)
- [ ] Policy CRUD operations
- [ ] Policy versioning
- [ ] Policy import/export
- [ ] Integrity verification
- [ ] Unit tests for storage
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Policy Storage
- **Preconditions:** Gateway running
- **Steps:**
  1. Create new policy
  2. Store in local storage
  3. Retrieve policy
- **Expected Result:** Policy persisted and retrievable
- **Pass Criteria:** Retrieved policy matches stored

### Test Case 2: Policy Update
- **Preconditions:** Policy exists
- **Steps:**
  1. Update policy rules
  2. Verify version incremented
  3. Verify old version archived
- **Expected Result:** Policy updated with history
- **Pass Criteria:** Both versions accessible

### Test Case 3: Policy Retrieval Performance
- **Preconditions:** 1000 policies stored
- **Steps:**
  1. Retrieve random policy 1000 times
  2. Measure average retrieval time
- **Expected Result:** Fast retrieval
- **Pass Criteria:** Average < 5ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Storage corruption | M | Integrity checks, backups |
| Policy versioning complexity | M | Clear versioning scheme |
| Concurrent access issues | M | Proper locking |

## Dependencies

- **Blocked by:** M3-001
- **Blocks:** M3-005
- **Related:** M4-002

## References

- PRD Section: 8.2 (FR-4: Local policy)
- Design Decision: 16.22 (Storage Backend)

## Open Questions

- SQLite vs embedded key-value store?
- Policy synchronization with ledger?
