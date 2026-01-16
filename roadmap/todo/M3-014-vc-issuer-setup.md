# M3-014: Set Up VC Issuer (POC CA)

## Metadata
- **Milestone:** M3 - Gateway Policy & Capability Tokens
- **Component:** Gateway
- **Priority:** P1
- **Status:** Todo

## User Story

As a system administrator, I want a VC Issuer (POC Certificate Authority) so that I can provision test credentials for operators and assets during POC evaluation.

## Requirements

### Functional Requirements
- FR-2: Issue Verifiable Credentials for operator identities
- FR-2: Issue Verifiable Credentials for asset (robot) identities
- Generate and manage issuer DID and signing keys
- Support credential schema for ChainKVM roles

### Non-Functional Requirements
- Issuer must be isolated from production systems
- Key material must be securely stored

## Definition of Done

- [ ] Issuer DID generated (did:key)
- [ ] Issuer signing keys securely stored
- [ ] Operator credential issuance implemented
- [ ] Asset credential issuance implemented
- [ ] Credential schema documented
- [ ] CLI or API for credential provisioning
- [ ] Test credentials generated for POC
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Issuer Setup
- **Preconditions:** Fresh environment
- **Steps:**
  1. Initialize VC Issuer
  2. Generate issuer DID
  3. Verify key material stored
- **Expected Result:** Issuer ready
- **Pass Criteria:** DID resolvable, keys secure

### Test Case 2: Operator Credential Issuance
- **Preconditions:** Issuer initialized
- **Steps:**
  1. Request operator credential
  2. Provide operator DID and role claims
  3. Receive signed VC
- **Expected Result:** Valid operator VC
- **Pass Criteria:** VC verifiable by Gateway

### Test Case 3: Asset Credential Issuance
- **Preconditions:** Issuer initialized
- **Steps:**
  1. Request asset credential
  2. Provide robot DID and capabilities
  3. Receive signed VC
- **Expected Result:** Valid asset VC
- **Pass Criteria:** VC verifiable by Gateway

### Test Case 4: Credential Verification
- **Preconditions:** Credentials issued
- **Steps:**
  1. Submit credential to Gateway
  2. Gateway verifies signature
  3. Gateway extracts claims
- **Expected Result:** Successful verification
- **Pass Criteria:** Claims accessible to policy engine

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Key compromise | H | Secure key storage, access controls |
| Credential misuse | M | Short TTL for POC credentials |
| Schema incompatibility | L | Align with W3C VC standards |

## Dependencies

- **Blocked by:** M3-002
- **Blocks:** M3-003 (verification needs test credentials)
- **Related:** M3-005, M3-006

## References

- PRD Section: 10.1 (High-level components - VC Issuer)
- PRD Section: 8.1 (FR-2: VC verification)

## Open Questions

- Should issuer support credential revocation for POC?
- What credential TTL for test credentials?
