# Gateway Architecture

The Gateway is the policy and authorization fast-path component for ChainKVM. It handles identity verification, policy evaluation, capability token issuance, and WebRTC signaling without ever blocking the real-time control path.

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GATEWAY                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Identity  │  │   Policy    │  │   Token     │  │  Signaling │ │
│  │   Verifier  │  │   Engine    │  │   Issuer    │  │   Server   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬─────┘ │
│         │                │                │                │        │
│  ┌──────┴────────────────┴────────────────┴────────────────┴─────┐ │
│  │                    Session Manager                             │ │
│  └──────────────────────────────────────────────────────────────┬─┘ │
│                                                                  │   │
│  ┌───────────────────┐  ┌───────────────────┐                   │   │
│  │ Revocation Cache  │  │  Audit Publisher  │◄──────────────────┘   │
│  └─────────┬─────────┘  └─────────┬─────────┘                       │
│            │                      │                                  │
└────────────┼──────────────────────┼──────────────────────────────────┘
             │                      │ (async)
             ▼                      ▼
      [Active Sessions]      [Hyperledger Fabric]
```

## Core Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Identity Verifier** | Resolve DIDs, verify VC/VP signatures, check issuer trust |
| **Policy Engine** | Evaluate ABAC rules deterministically against local snapshot |
| **Token Issuer** | Generate short-lived capability tokens (JWT/EdDSA) |
| **Signaling Server** | WebSocket relay for SDP/ICE exchange |
| **Session Manager** | Track active sessions, enforce limits, handle lifecycle |
| **Revocation Cache** | Immediate invalidation of tokens/sessions |
| **Audit Publisher** | Async queue for ledger event publishing |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| HTTP Server | Fastify |
| WebSocket | @fastify/websocket |
| JWT Signing | Ed25519 (EdDSA) |
| DID Method | did:key (POC) |

## Key Design Principles

### 1. Blockchain Never Blocks Control

The ledger is only used for audit trail. All policy decisions use local snapshots. Audit events are published asynchronously with backpressure.

### 2. Short-Lived Tokens

Capability tokens have a default TTL of 3600s. Short lifetimes limit the window for replay attacks and reduce revocation complexity.

### 3. Push-Based Revocation

Revocation is pushed to active sessions via WebSocket. Combined with short TTL, this ensures fast access termination.

### 4. Deterministic Policy Evaluation

Policy evaluation uses ordered ABAC rules with first-match semantics. No external calls during evaluation ensures consistent, auditable decisions.

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNTRUSTED ZONE                                │
│  ┌──────────────┐                                               │
│  │ Web Console  │ Operator browser/device                       │
│  └──────┬───────┘                                               │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTPS/WSS
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRUSTED EDGE                                  │
│  ┌──────────────┐                                               │
│  │   Gateway    │ Policy enforcement, token issuance            │
│  └──────┬───────┘                                               │
└─────────┼───────────────────────────────────────────────────────┘
          │ WSS (signaling) + P2P WebRTC
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROBOT DOMAIN                                  │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ Robot Agent  │──│ Safety Path  │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Points

### With Web Console

1. **Session Creation**: `POST /v1/sessions` with operator VC/VP
2. **Signaling**: WebSocket at `/v1/signal` for SDP/ICE exchange
3. **Revocation**: Receives `revoked` message, disables control UI

### With Robot Agent

1. **Token Validation**: Robot fetches JWKS from `/.well-known/jwks.json`
2. **Signaling**: Robot connects to `/v1/signal` with role=robot
3. **Revocation**: Receives `revoked` message, enters safe-stop

### With Hyperledger Fabric

1. **Audit Publishing**: Async queue with batching
2. **Event Types**: SESSION_REQUESTED, SESSION_GRANTED, SESSION_STARTED, SESSION_ENDED, SESSION_REVOKED, PRIVILEGED_ACTION

## Scalability Considerations

### Horizontal Scaling

- Gateway is stateless for request handling
- Session state uses in-memory Map (POC); production uses Redis
- Signaling requires sticky sessions or distributed pub/sub

### Performance Targets

| Metric | Target |
|--------|--------|
| Session creation | < 500ms p95 |
| Policy evaluation | < 50ms |
| Signaling latency | < 100ms per message |
| Concurrent sessions | 100+ |

### Rate Limiting

- Per-IP connection limits
- Per-session control message rate: 20 Hz default
- Authentication attempts: 10/minute per IP

## Configuration

Environment variables for Gateway configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | HTTP/WS server port |
| `SESSION_TTL_SECONDS` | 3600 | Token expiry window |
| `MAX_CONTROL_RATE_HZ` | 20 | Control message rate limit |
| `MAX_VIDEO_BITRATE_KBPS` | 4000 | Video bitrate constraint |
| `STUN_URL` | (required) | STUN server URL |
| `TURN_URL` | (optional) | TURN server URL |
| `TURN_SECRET` | (optional) | TURN credential secret |

## Related Documentation

- [API Reference](./API.md) - REST and WebSocket endpoints
- [Data Flow](./DATAFLOW.md) - Session establishment and revocation flows
- [Policy Model](../POLICY.md) - ABAC rule evaluation
- [Identity Model](../IDENTITY.md) - DID and VC verification
- [Security Model](../SECURITY.md) - Trust boundaries and threat model
