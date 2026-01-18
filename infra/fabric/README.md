# Hyperledger Fabric Infrastructure

Local Fabric network for audit trail storage.

## Prerequisites

- Docker & Docker Compose
- Fabric binaries (peer, orderer, configtxgen) v2.5+
- Go 1.22+ (for chaincode development)

## Quick Start

```bash
# Start the Fabric network
./network.sh up

# Deploy chaincode
./network.sh deployCC -ccn audit -ccp ../chaincode/audit

# Stop network
./network.sh down
```

## Network Topology (POC)

Single-org network for development:

```
org1.chainkvm.local
├── peer0.org1.chainkvm.local
├── orderer.chainkvm.local
└── ca.org1.chainkvm.local
```

## Chaincode

The audit chaincode (`chaincode/audit/`) stores:

- `SESSION_STARTED` events
- `SESSION_ENDED` events
- `PRIVILEGED_ACTION` events
- `TOKEN_REVOKED` events

Query by session_id, time range, or operator_did.

## Configuration

| File | Purpose |
|------|---------|
| `configtx.yaml` | Channel/org configuration |
| `docker-compose.yaml` | Container orchestration |
| `connection-org1.json` | Gateway connection profile |

## Gateway Integration

The Gateway service uses the connection profile to publish audit events:

```typescript
import { connect } from '@hyperledger/fabric-gateway';
// ... connect using connection-org1.json
```
