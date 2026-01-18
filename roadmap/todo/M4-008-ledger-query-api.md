# M4-008: Implement Ledger Query API

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Ledger
- **Priority:** P1
- **Status:** Todo

## User Story

As a compliance officer, I want to query the audit ledger so that I can review historical events and generate reports.

## Requirements

### Functional Requirements
- The Gateway SHALL provide an API to query the Ledger for past session activity

### Non-Functional Requirements
- Query response < 2 seconds for typical queries
- Support pagination for large result sets

## Definition of Done

- [ ] Feature branch created (`feature/M4-008-ledger-query-api`)
- [ ] Query by session ID
- [ ] Query by time range
- [ ] Query by actor DID
- [ ] Query by event type
- [ ] Pagination support
- [ ] Result filtering
- [ ] API documentation
- [ ] Unit tests for queries
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Query by Session
- **Preconditions:** Events stored for session
- **Steps:**
  1. Query events by session ID
  2. Verify all session events returned
- **Expected Result:** Complete session history
- **Pass Criteria:** All events for session

### Test Case 2: Query by Time Range
- **Preconditions:** Events across time range
- **Steps:**
  1. Query events for last hour
  2. Verify only in-range events
- **Expected Result:** Filtered results
- **Pass Criteria:** No out-of-range events

### Test Case 3: Pagination
- **Preconditions:** 1000+ events
- **Steps:**
  1. Query with page size 100
  2. Iterate through pages
  3. Verify all events retrieved
- **Expected Result:** Complete result set
- **Pass Criteria:** No duplicates, no gaps

### Test Case 4: Query Performance
- **Preconditions:** Large event set
- **Steps:**
  1. Execute typical query
  2. Measure response time
- **Expected Result:** Fast query
- **Pass Criteria:** Response < 2 seconds

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Slow queries | M | Indexing, query optimization |
| Large result sets | M | Pagination required |
| Unauthorized access | H | Query authorization |

## Dependencies

- **Blocked by:** M4-002
- **Blocks:** None
- **Related:** M4-009

## References

- PRD Section: 8.4 (Audit trail / blockchain)
- Design Decision: 16.39 (Query API)

## Open Questions

- GraphQL vs REST for queries?
- Real-time event streaming?
