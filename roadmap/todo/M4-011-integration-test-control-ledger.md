# M4-011: Build Integration Test (Control + Ledger)

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** QA
- **Priority:** P1
- **Status:** Todo

## User Story

As a QA engineer, I want integration tests covering control flow and audit logging together so that the full system is verified.

## Requirements

### Functional Requirements
- Test complete control-to-audit flow
- Verify events match actions
- Test failure scenarios

### Non-Functional Requirements
- Tests run in < 10 minutes
- Cover critical paths

## Definition of Done

- [ ] Session lifecycle test
- [ ] Command execution audit test
- [ ] Revocation audit test
- [ ] E-Stop audit test
- [ ] Failure recovery tests
- [ ] End-to-end timing tests
- [ ] CI integration
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Full Session Audit
- **Preconditions:** Full system running
- **Steps:**
  1. Start session
  2. Execute commands
  3. End session
  4. Query audit trail
- **Expected Result:** Complete audit
- **Pass Criteria:** All events present and accurate

### Test Case 2: Command-Audit Correlation
- **Preconditions:** System running
- **Steps:**
  1. Execute 100 commands
  2. Query audit events
  3. Correlate commands to events
- **Expected Result:** 1:1 correlation
- **Pass Criteria:** Every command has audit event

### Test Case 3: Failure Recovery
- **Preconditions:** System running
- **Steps:**
  1. Start session with commands
  2. Simulate ledger failure
  3. Continue commands
  4. Restore ledger
  5. Verify all events eventually logged
- **Expected Result:** No audit loss
- **Pass Criteria:** All events present

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Complex test setup | M | Docker Compose orchestration |
| Non-deterministic failures | M | Retry logic, careful timing |
| Long test execution | M | Parallel execution |

## Dependencies

- **Blocked by:** M4-006, M4-007
- **Blocks:** None
- **Related:** M4-012

## References

- PRD Section: 8.4 (Audit trail)
- Design Decision: 16.42 (Integration Strategy)

## Open Questions

- Which scenarios are critical path?
- Chaos testing for ledger?
