# M3-006: Implement Capability Token Schema & Generation

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want to generate capability tokens so that operators receive scoped, time-limited access to robot resources.

## Requirements

### Functional Requirements
- FR-5: The Gateway SHALL issue capability tokens specifying allowed actions, resource scope, and TTL

### Non-Functional Requirements
- Token generation < 10ms

## Definition of Done

- [ ] Token schema definition (JWT-based)
- [ ] Claims specification (actions, scope, TTL)
- [ ] Token signing implementation
- [ ] Token serialization
- [ ] Schema validation
- [ ] Generation API endpoint
- [ ] Unit tests for generation
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Token Generation
- **Preconditions:** Policy evaluation passed
- **Steps:**
  1. Request token for operator
  2. Specify actions and scope
  3. Generate token
- **Expected Result:** Valid token generated
- **Pass Criteria:** Token contains correct claims

### Test Case 2: Token Structure
- **Preconditions:** Token generated
- **Steps:**
  1. Decode token
  2. Verify claims present
  3. Verify signature valid
- **Expected Result:** Well-formed token
- **Pass Criteria:** All required claims present

### Test Case 3: Scoped Token
- **Preconditions:** Gateway running
- **Steps:**
  1. Request token for "drive" action only
  2. Verify token scope limited
- **Expected Result:** Token scoped correctly
- **Pass Criteria:** Only "drive" in allowed actions

### Test Case 4: Generation Performance
- **Preconditions:** Gateway running
- **Steps:**
  1. Generate 1000 tokens
  2. Measure average time
- **Expected Result:** Fast generation
- **Pass Criteria:** Average < 10ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Token theft/replay | H | Short TTL, binding to session |
| Schema evolution | M | Version tokens, backward compatibility |
| Signing key security | H | Secure key storage, rotation |

## Dependencies

- **Blocked by:** M3-001, M3-005
- **Blocks:** M1-004, M3-007, M3-010
- **Related:** M3-008

## References

- PRD Section: 8.2 (FR-5: Capability token)
- PRD Section: 11.1 (Capability token schema)
- Design Decision: 16.24 (Token Format)

## Open Questions

- Token refresh mechanism?
- Maximum TTL for POC?
