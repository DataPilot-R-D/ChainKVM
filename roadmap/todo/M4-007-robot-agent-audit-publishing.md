# M4-007: Implement Robot Agent Audit Publishing

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Robot Agent
- **Priority:** P1
- **Status:** Todo

## User Story

As a compliance officer, I want privileged robot actions (E_STOP, MODE_SWITCH) logged to the ledger so that there's an auditable record of safety-critical operations.

## Requirements

### Functional Requirements
- FR-11: Robot Agent logs privileged actions (E_STOP, MODE_SWITCH) to ledger

**Note:** Per PRD Design Decision 16.3, minimal logging satisfies compliance without full command streams.

### Non-Functional Requirements
- Audit publishing must not block command execution
- Support offline queuing

## Definition of Done

- [ ] Feature branch created (`feature/M4-007-robot-agent-audit-publishing`)
- [ ] Event generation for privileged actions (E_STOP, MODE_SWITCH)
- [ ] Event generation for errors
- [ ] Local queue for offline operation
- [ ] Gateway relay for ledger writes
- [ ] Sync on reconnection
- [ ] Unit tests for publishing
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Privileged Action Events
- **Preconditions:** Robot Agent connected
- **Steps:**
  1. Trigger MODE_SWITCH action
  2. Verify PRIVILEGED_ACTION event generated
  3. Check event contains action type and timestamp
- **Expected Result:** Privileged action audited
- **Pass Criteria:** Event in ledger

### Test Case 2: E-Stop Events
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Trigger E-Stop
  2. Verify e_stop event logged
  3. Check event priority
- **Expected Result:** E-Stop audited
- **Pass Criteria:** Event recorded

### Test Case 3: Offline Queuing
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Disconnect from Gateway
  2. Execute commands
  3. Verify events queued locally
  4. Reconnect
  5. Verify events synced
- **Expected Result:** No event loss
- **Pass Criteria:** All events in ledger

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Storage exhaustion offline | M | Bounded queue, oldest drop |
| Sync conflicts | M | Timestamp ordering |
| Privacy concerns | M | Minimal event data |

## Dependencies

- **Blocked by:** M4-003, M1-003
- **Blocks:** M4-011
- **Related:** M4-006

## References

- PRD Section: 8.4 (Audit trail / blockchain - FR-11, FR-12)
- Design Decision: 16.3 (Minimal logging)
- Design Decision: 16.38 (Edge Audit)

## Open Questions

- Direct ledger write or via Gateway?
- How much command detail in events?
