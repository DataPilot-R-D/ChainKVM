# M3-002: Implement DID Resolver (did:key)

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want to resolve DIDs to public keys so that I can verify the identity of operators and assets.

## Requirements

### Functional Requirements
- FR-1: The Gateway SHALL resolve did:key identifiers to public keys

### Non-Functional Requirements
- DID resolution < 10ms for did:key

## Definition of Done

- [ ] did:key method implementation
- [ ] Public key extraction
- [ ] DID Document generation
- [ ] Caching for repeated resolutions
- [ ] Error handling for invalid DIDs
- [ ] Unit tests for resolver
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Valid DID Resolution
- **Preconditions:** Gateway running
- **Steps:**
  1. Submit valid did:key identifier
  2. Retrieve public key
  3. Verify key matches expected
- **Expected Result:** Correct public key returned
- **Pass Criteria:** Key matches generation input

### Test Case 2: Invalid DID Handling
- **Preconditions:** Gateway running
- **Steps:**
  1. Submit malformed DID
  2. Submit unsupported DID method
- **Expected Result:** Clear error responses
- **Pass Criteria:** Appropriate error codes

### Test Case 3: Resolution Performance
- **Preconditions:** Gateway running
- **Steps:**
  1. Resolve 1000 DIDs sequentially
  2. Measure average resolution time
- **Expected Result:** Fast resolution
- **Pass Criteria:** Average < 10ms

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DID method spec changes | L | Use stable spec version |
| Cryptographic library issues | M | Use well-tested libraries |
| Performance under load | M | Implement caching |

## Dependencies

- **Blocked by:** M3-001
- **Blocks:** M3-003, M3-005
- **Related:** M3-006

## References

- PRD Section: 8.1 (FR-1: DID identities)
- Design Decision: 16.20 (DID Methods)

## Open Questions

- Support for other DID methods in future?
- Key rotation handling?
