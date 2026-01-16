# M4-006: Integrate Gateway Audit Event Publishing

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a compliance officer, I want all gateway actions logged to the ledger so that there's a complete audit trail of authorization decisions.

## Requirements

### Functional Requirements
- FR-11: Gateway logs audit events to ledger

### Non-Functional Requirements
- No event loss during normal operation
- Event publishing < 50ms (async)

## Definition of Done

- [ ] Event generation for session start/end
- [ ] Event generation for policy decisions
- [ ] Event generation for token operations
- [ ] Integration with async queue
- [ ] Ledger client implementation
- [ ] Error handling and retry
- [ ] Unit tests for publishing
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Session Events
- **Preconditions:** Gateway and ledger running
- **Steps:**
  1. Start operator session
  2. Verify session_start event logged
  3. End session
  4. Verify session_end event logged
- **Expected Result:** Events recorded
- **Pass Criteria:** Events in ledger with correct data

### Test Case 2: Policy Decision Events
- **Preconditions:** Gateway running
- **Steps:**
  1. Submit credential for evaluation
  2. Verify policy_decision event logged
  3. Check decision recorded (allow/deny)
- **Expected Result:** Decision audited
- **Pass Criteria:** Event contains decision

### Test Case 3: Token Events
- **Preconditions:** Gateway running
- **Steps:**
  1. Generate capability token
  2. Verify token_issued event
  3. Revoke token
  4. Verify token_revoked event
- **Expected Result:** Token lifecycle audited
- **Pass Criteria:** All events present

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Event loss | H | Persistence, retry logic |
| Performance impact | M | Async processing verified |
| Schema mismatches | M | Validation before publish |

## Dependencies

- **Blocked by:** M4-001, M4-002, M4-003, M4-004
- **Blocks:** M4-010, M4-011
- **Related:** M3-005, M3-006

## References

- PRD Section: 8.4 (FR-11, FR-12: Audit)
- Design Decision: 16.37 (Audit Points)

## Open Questions

- All policy evaluations or just grants?
- Include full context in events?
