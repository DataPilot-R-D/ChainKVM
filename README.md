# ChainKVM

ChainKVM is a proof-of-concept for secure robot teleoperation with WebRTC video/control and a blockchain-backed audit trail.

## POC goals

- Secure session establishment with short-lived capability tokens.
- Low-latency control path (crypto/auth off the real-time path).
- Auditable session lifecycle and privileged actions.
- Repeatable latency and reliability measurements.

## Key docs

- Architecture overview and diagrams: `docs/architecture/README.md`
- Interfaces and schemas: `docs/architecture/INTERFACES.md`
- Security model: `docs/architecture/SECURITY.md`
- Observability and measurement: `docs/architecture/OBSERVABILITY.md`
- Roadmap alignment: `docs/architecture/ROADMAP.md`

## Repository layout

| Path | Purpose |
|------|---------|
| `apps/console` | Operator web console (React + WebRTC) |
| `services/gateway` | Policy + session gateway (Fastify REST/WS) |
| `robot-agent` | Robot-side agent (Go + Pion WebRTC) |
| `infra/turn` | coturn configuration for NAT traversal |
| `infra/fabric` | Hyperledger Fabric scaffolding + audit chaincode |
| `docs/architecture` | Architecture decisions and Mermaid diagrams |
| `roadmap` | Task breakdown and milestones |

## Target environment (POC)

- **Robot:** Unitree Go2 Pro running ROS 2 on Ubuntu 22.04.
- **Video source (initial):** developer laptop/desktop webcam.
- **Ledger:** Hyperledger Fabric wired early (no audit stub phase).
- **TURN:** local coturn for relay fallback.

## Prerequisites

- Node.js 18+ (console and gateway)
- Go 1.22+ (robot agent and chaincode)
- Docker + Docker Compose (TURN/Fabric)
- ROS 2 (robot environment)

## Local startup (dev)

- TURN (optional but recommended): `infra/turn`
- Gateway: `services/gateway`
- Web console: `apps/console`
- Robot agent: `robot-agent`
- Fabric (optional): `infra/fabric`

See the component READMEs for exact commands and env vars.

## Day 1 demo runbook (local, stubbed)

1) Start TURN (optional):

```bash
cd infra/turn
docker-compose up -d
```

2) Start the gateway:

```bash
cd services/gateway
npm install
npm run dev
```

3) Sanity-check health:

```bash
curl http://localhost:4000/health
```

4) Create a session and capture `session_id` from the response:

```bash
curl -X POST http://localhost:4000/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "robot_id": "robot-001",
    "operator_did": "did:key:z6MkExample",
    "vc_or_vp": "eyJ...",
    "requested_scope": ["teleop:view", "teleop:control"]
  }'
```

5) Fetch the session state:

```bash
curl http://localhost:4000/v1/sessions/<session_id>
```

6) Start the console UI (layout only for now):

```bash
cd apps/console
npm install
npm run dev
```

Open the URL shown by Vite (default `http://localhost:3000`).

7) Start the robot agent stub (logs only):

```bash
cd robot-agent
go mod download
go run ./cmd/agent
```

Notes:
- WebRTC wiring, VC verification, signed tokens, and Fabric publishing are stubbed or planned.
- Use `services/gateway/README.md` for the current endpoint list and signaling message formats.

## Configuration

Each component documents its environment variables:

- Console: `apps/console/README.md`
- Gateway: `services/gateway/README.md`
- Robot Agent: `robot-agent/README.md`
- TURN: `infra/turn/README.md`
- Fabric: `infra/fabric/README.md`

## Status

Core scaffolding is in place for the gateway, console, and robot agent. Several features are stubbed (VC verification, signed tokens, policy engine, Fabric publishing). See `roadmap/README.md` and `PRD.md` for scope and milestones.
