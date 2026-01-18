# M4-001: Set Up Hyperledger Fabric Test Network

## Metadata
- **Milestone:** M4 - Ledger Integration & Audit Trail
- **Component:** Ledger
- **Priority:** P0
- **Status:** Todo

## User Story

As a system administrator, I want a Hyperledger Fabric test network so that the audit trail functionality can be developed and tested.

## Requirements

### Functional Requirements
- Fabric network operational
- Single organization for POC
- Peer nodes and ordering service running

### Non-Functional Requirements
- Network setup reproducible
- Support for development iteration

## Definition of Done

- [ ] Feature branch created (`feature/M4-001-hyperledger-fabric-setup`)
- [ ] Fabric network configuration defined
- [ ] Docker Compose setup for local development
- [ ] Network bootstrap scripts
- [ ] Channel creation and joining
- [ ] Basic chaincode deployment verified
- [ ] Network monitoring setup
- [ ] Documentation for developers
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Network Startup
- **Preconditions:** Docker installed
- **Steps:**
  1. Run network startup script
  2. Verify all containers running
  3. Check peer connectivity
- **Expected Result:** Network operational
- **Pass Criteria:** All nodes healthy

### Test Case 2: Channel Operations
- **Preconditions:** Network running
- **Steps:**
  1. Create audit channel
  2. Join peers to channel
  3. Verify channel membership
- **Expected Result:** Channel operational
- **Pass Criteria:** Peers show channel joined

### Test Case 3: Basic Chaincode Test
- **Preconditions:** Network and channel ready
- **Steps:**
  1. Deploy test chaincode
  2. Invoke chaincode function
  3. Query chaincode state
- **Expected Result:** Chaincode functional
- **Pass Criteria:** State correctly stored/retrieved

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fabric version complexity | M | Use LTS version, follow tutorials |
| Resource requirements | M | Optimize for development, document requirements |
| Network instability | M | Health monitoring, restart scripts |

## Dependencies

- **Blocked by:** None (can start in parallel)
- **Blocks:** M4-002, M4-003, M4-006
- **Related:** M3-001

## References

- PRD Section: 7.1 (POC scope - Ledger)
- Design Decision: 16.32 (Fabric Configuration)

## Open Questions

- Fabric 2.x vs 3.x?
- CouchDB vs LevelDB for state?
