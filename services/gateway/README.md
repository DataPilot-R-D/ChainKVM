# Gateway Service

Central service for ChainKVM: policy evaluation, capability token issuance, WebRTC signaling, and async audit publishing.

## Stack

- Node.js + TypeScript
- Fastify for HTTP/WebSocket
- Ed25519 for JWT/JWS signing (EdDSA)

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload (http://localhost:4000)
npm run dev

# Type check
npm run typecheck

# Run tests
npm test

# Build for production
npm run build
npm start
```

## API Endpoints

### Session Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/sessions` | POST | Create session (VC verification + token issuance) |
| `/v1/sessions/:session_id` | GET | Get session state |
| `/v1/sessions/:session_id` | DELETE | Operator-initiated teardown |

### Admin / Revocation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/revocations` | POST | Revoke session(s) by session_id or operator_did |
| `/v1/revocations/:revocation_id` | GET | Get revocation details |

### Audit Query

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/audit/events` | GET | Query audit events with filters |
| `/v1/audit/events/:event_id` | GET | Get single audit event |

Query parameters for `/v1/audit/events`:
- `session_id` - Filter by session
- `robot_id` - Filter by robot
- `actor_did` - Filter by operator DID
- `event_type` - Filter by event type
- `from`, `to` - Time range (ISO 8601)
- `page`, `page_size` - Pagination

### Health & Keys

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/v1/health` | GET | Health check |
| `/v1/ready` | GET | Readiness check |
| `/.well-known/jwks.json` | GET | Public keys for token verification |
| `/v1/jwks` | GET | Alias for JWKS |

### WebSocket Signaling

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `/v1/signal` | WS | WebRTC signaling (SDP/ICE exchange) |

Signaling message types:
- `join` - Join a session room: `{ type: "join", session_id, role }`
- `offer` - SDP offer: `{ type: "offer", session_id, sdp }`
- `answer` - SDP answer: `{ type: "answer", session_id, sdp }`
- `ice` - ICE candidate: `{ type: "ice", session_id, candidate }`
- `leave` - Leave session: `{ type: "leave", session_id }`
- `session_state` - State notification (server → client)
- `revoked` - Revocation notification (server → client)
- `error` - Error response: `{ type: "error", code, message }`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `TURN_URL` | `turn:localhost:3478` | TURN server URL |
| `TURN_SECRET` | (dev default) | Shared secret for TURN credentials |
| `STUN_URL` | `stun:stun.l.google.com:19302` | STUN server URL |
| `SESSION_TTL_SECONDS` | `3600` | Session/token TTL |
| `MAX_CONTROL_RATE_HZ` | `20` | Max control command rate |
| `MAX_VIDEO_BITRATE_KBPS` | `4000` | Max video bitrate |

## Project Structure

```
src/
  index.ts           - Entry point, server setup
  config.ts          - Configuration loading
  types.ts           - TypeScript types for API
  routes/
    health.ts        - Health/readiness endpoints
    sessions.ts      - Session management
    revocations.ts   - Admin revocation
    audit.ts         - Audit event queries
    jwks.ts          - JWKS endpoint
    signaling.ts     - WebSocket signaling
```

## Current Status (POC Stubs)

- [x] Session creation (stub token, no VC verification)
- [x] Session state management (in-memory)
- [x] Revocation endpoint (in-memory)
- [x] Audit query (stub data)
- [x] JWKS endpoint (static dev key)
- [x] WebSocket signaling (room-based relay)
- [ ] VC/VP verification (M3-003)
- [ ] Real JWT signing with Ed25519 (M3-006)
- [ ] Policy evaluation (M3-005)
- [ ] Fabric audit publishing (M4-006)
- [ ] TURN credential generation (M2-005)

## Example Usage

### Create Session

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

### Query Audit Events

```bash
curl "http://localhost:4000/v1/audit/events?robot_id=robot-001&page_size=10"
```

### WebSocket Signaling

```javascript
const ws = new WebSocket('ws://localhost:4000/v1/signal');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', session_id: 'ses_xxx', role: 'operator' }));
};
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```
