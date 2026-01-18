# M4-004: Implement Async Event Queue

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want audit events queued asynchronously so that ledger writes don't block control operations.

## Requirements

### Functional Requirements
- FR-11: The Gateway SHALL log audit-relevant events to the Ledger asynchronously, ensuring control path latency is not affected

### Non-Functional Requirements
- Queue should handle 1000 events/second
- Event persistence until confirmed written

## Definition of Done

- [ ] Feature branch created (`feature/M4-004-async-event-queue`)
- [ ] In-memory queue implementation
- [ ] Persistent queue backup
- [ ] Queue consumer for ledger writes
- [ ] Event ordering guarantees
- [ ] Queue depth monitoring
- [ ] Dead letter handling
- [ ] Unit tests for queue
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Event Queuing
- **Preconditions:** Queue system running
- **Steps:**
  1. Generate audit event
  2. Add to queue
  3. Verify queued
- **Expected Result:** Event in queue
- **Pass Criteria:** Event retrievable from queue

### Test Case 2: Async Processing
- **Preconditions:** Queue with events
- **Steps:**
  1. Queue 100 events
  2. Measure queuing time
  3. Verify control path not blocked
- **Expected Result:** Fast queuing
- **Pass Criteria:** Queue time < 5ms per event

### Test Case 3: Queue Persistence
- **Preconditions:** Events in queue
- **Steps:**
  1. Queue 100 events
  2. Restart gateway
  3. Verify events still pending
- **Expected Result:** Events persisted
- **Pass Criteria:** No event loss on restart

### Test Case 4: Consumer Processing
- **Preconditions:** Events queued
- **Steps:**
  1. Start consumer
  2. Verify events written to ledger
  3. Check acknowledgment
- **Expected Result:** Events processed
- **Pass Criteria:** All events written

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Queue overflow | M | Backpressure, monitoring |
| Event loss | H | Persistence, acknowledgment |
| Ordering issues | M | Sequence numbers, timestamps |

## Dependencies

- **Blocked by:** M3-001, M4-003
- **Blocks:** M4-005, M4-006
- **Related:** M4-012

## References

- PRD Section: 8.4 (FR-11: Async writes)
- Design Decision: 16.35 (Queue Architecture)

## Open Questions

- In-process vs external queue?
- Batching strategy for writes?
