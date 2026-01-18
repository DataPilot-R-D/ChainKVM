# M5-006: Implement Repeated-Invalid-Command Detection

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Robot Agent
- **Priority:** P1
- **Status:** Todo

## User Story

As a Robot Agent, I want to detect repeated invalid commands so that I can protect against compromised or malfunctioning operator clients.

## Requirements

### Functional Requirements
- FR-14: Robot must enter safe state on repeated invalid control commands

### Non-Functional Requirements
- Detection within 10 invalid commands
- Minimal performance overhead

## Definition of Done

- [ ] Feature branch created (`feature/M5-006-repeated-invalid-command-detection`)
- [ ] Invalid command counter
- [ ] Configurable threshold
- [ ] Time window for counting
- [ ] Different severity levels
- [ ] Safe state trigger
- [ ] Alert/audit generation
- [ ] Unit tests for detection
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Threshold Detection
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Send 5 invalid commands (below threshold)
  2. Verify no safe state
  3. Send 5 more invalid commands
  4. Verify safe state triggered
- **Expected Result:** Threshold enforced
- **Pass Criteria:** Safe state at threshold

### Test Case 2: Time Window Reset
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Send 5 invalid commands
  2. Wait for window expiry
  3. Send 5 invalid commands
  4. Verify no safe state
- **Expected Result:** Counter resets
- **Pass Criteria:** No premature trigger

### Test Case 3: Mixed Valid/Invalid Commands
- **Preconditions:** Robot Agent running
- **Steps:**
  1. Alternate valid and invalid commands
  2. Verify threshold considers only invalid
- **Expected Result:** Valid commands don't reset
- **Pass Criteria:** Correct counting logic

### Test Case 4: Audit Trail
- **Preconditions:** Threshold exceeded
- **Steps:**
  1. Exceed invalid command threshold
  2. Query audit events
- **Expected Result:** Event logged
- **Pass Criteria:** ANOMALY event present

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positives from bugs | M | Clear error classification |
| Threshold gaming | L | Time window limits |
| Performance overhead | L | Efficient counting |

## Dependencies

- **Blocked by:** M1-003, M1-005
- **Blocks:** M5-007
- **Related:** M3-013

## References

- PRD Section: 8.5 (FR-14: Local safety)
- Design Decision: 16.6 (Safe State Definition)

## Open Questions

- Threshold value for POC (10 suggested)?
- Time window duration?
