# M3-003: Implement VC Signature Verification

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P0
- **Status:** Todo

## User Story

As a gateway operator, I want to verify Verifiable Credential signatures so that I can trust operator credentials.

## Requirements

### Functional Requirements
- FR-2: The Gateway SHALL verify VC/VP signatures before trusting presented credentials

### Non-Functional Requirements
- Signature verification < 50ms

## Definition of Done

- [ ] JWT-VC signature verification
- [ ] Issuer DID resolution
- [ ] Signature algorithm support (Ed25519, ES256)
- [ ] Credential expiry validation
- [ ] Revocation status check (basic)
- [ ] Unit tests for verification
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Valid VC Verification
- **Preconditions:** Gateway running, valid VC available
- **Steps:**
  1. Submit VC for verification
  2. Verify signature valid
  3. Verify issuer trusted
- **Expected Result:** VC accepted
- **Pass Criteria:** Verification passes

### Test Case 2: Tampered VC Rejection
- **Preconditions:** Gateway running
- **Steps:**
  1. Modify VC claim after signing
  2. Submit for verification
- **Expected Result:** VC rejected
- **Pass Criteria:** "invalid_signature" error

### Test Case 3: Expired VC Rejection
- **Preconditions:** Gateway running
- **Steps:**
  1. Submit VC with past expiry
  2. Verify rejection
- **Expected Result:** VC rejected
- **Pass Criteria:** "credential_expired" error

### Test Case 4: Untrusted Issuer
- **Preconditions:** Gateway running
- **Steps:**
  1. Submit VC from unknown issuer
  2. Verify rejection
- **Expected Result:** VC rejected
- **Pass Criteria:** "untrusted_issuer" error

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cryptographic vulnerabilities | H | Use audited libraries |
| Algorithm support gaps | M | Support common algorithms |
| Issuer trust management | M | Clear trusted issuer configuration |

## Dependencies

- **Blocked by:** M3-001, M3-002
- **Blocks:** M3-005
- **Related:** M3-006, M5-001

## References

- PRD Section: 8.1 (FR-2: VC verification)
- Design Decision: 16.21 (VC Format)

## Open Questions

- Which VC formats to support (JWT-VC vs JSON-LD)?
- Revocation list mechanism for POC?
