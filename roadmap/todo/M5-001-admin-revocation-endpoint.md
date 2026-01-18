# M5-001: Implement Admin Revocation Endpoint

## Metadata
- **Milestone:** M5 - Revocation + Safe-Stop Integration
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a site admin, I want to revoke operator access immediately so that unauthorized or compromised sessions can be terminated.

## Requirements

### Functional Requirements
- FR-7: Admin can revoke a session; gateway terminates it

### Non-Functional Requirements
- Revocation API response < 100ms
- Revocation propagation < 1 second

## Definition of Done

- [ ] Feature branch created (`feature/M5-001-admin-revocation-endpoint`)
- [ ] REST API endpoint for revocation
- [ ] Authentication/authorization for admin
- [ ] Single session revocation
- [ ] Bulk revocation (by operator)
- [ ] Revocation reason capture
- [ ] Audit event generation
- [ ] Unit tests for endpoint
- [ ] Tests passing
- [ ] Code simplified
- [ ] PR created
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Single Session Revocation
- **Preconditions:** Active session exists
- **Steps:**
  1. Admin calls revocation endpoint with session ID
  2. Verify endpoint returns success
  3. Verify session terminated
- **Expected Result:** Session revoked
- **Pass Criteria:** API returns 200, session invalid

### Test Case 2: Bulk Revocation by Operator
- **Preconditions:** Multiple sessions for one operator
- **Steps:**
  1. Admin calls revocation with operator DID
  2. Verify all sessions terminated
- **Expected Result:** All operator sessions revoked
- **Pass Criteria:** All sessions invalid

### Test Case 3: Unauthorized Revocation Attempt
- **Preconditions:** Non-admin user
- **Steps:**
  1. Attempt revocation without admin privileges
- **Expected Result:** Request denied
- **Pass Criteria:** 403 Forbidden response

### Test Case 4: Audit Trail
- **Preconditions:** Admin privileges
- **Steps:**
  1. Revoke session
  2. Query audit ledger
- **Expected Result:** Revocation event logged
- **Pass Criteria:** SESSION_REVOKED event present

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Unauthorized revocation | H | Strong admin authentication |
| Revocation not propagating | H | Confirmation mechanism |
| Admin lockout | M | Emergency recovery procedure |

## Dependencies

- **Blocked by:** M3-008
- **Blocks:** M5-002, M5-003
- **Related:** M5-011

## References

- PRD Section: 8.2 (FR-7: Revocation)
- Design Decision: 16.26 (Revocation Strategy)

## Open Questions

- Revocation notification to operator?
- Grace period before hard termination?
