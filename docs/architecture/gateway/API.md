# Gateway API Reference

This document defines the REST and WebSocket API contracts for the Gateway service.

## Base URL

```
https://gateway.chainkvm.local:4000
```

## Authentication

Most endpoints require a capability token in the Authorization header:

```
Authorization: Bearer <capability_token>
```

## REST Endpoints

### Health Checks

#### GET /health

Basic liveness check.

**Response**: `200 OK`
```json
{
  "status": "ok"
}
```

#### GET /v1/ready

Readiness check including dependency status.

**Response**: `200 OK`
```json
{
  "status": "ready",
  "checks": {
    "signaling": "up",
    "audit_queue": "healthy"
  }
}
```

---

### Session Management

#### POST /v1/sessions

Create a new control session.

**Request Body**:
```json
{
  "robot_id": "robot-001",
  "operator_did": "did:key:z6Mk...",
  "vc_or_vp": "<JWT VC/VP>",
  "requested_scope": ["drive", "camera"]
}
```

**Response**: `201 Created`
```json
{
  "session_id": "sess_abc123",
  "capability_token": "<JWT>",
  "signaling_url": "wss://gateway.chainkvm.local:4000/v1/signal",
  "ice_servers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "turn:turn.chainkvm.local:3478", "username": "...", "credential": "..." }
  ],
  "expires_at": "2026-01-17T10:00:00Z",
  "effective_scope": ["drive", "camera"],
  "limits": {
    "max_control_rate_hz": 20,
    "max_video_bitrate_kbps": 4000
  },
  "policy": {
    "version": "2026-01-01",
    "hash": "sha256:abc..."
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - VC verification failed
- `403 Forbidden` - Policy denied access

---

#### GET /v1/sessions/:session_id

Get session state.

**Response**: `200 OK`
```json
{
  "session_id": "sess_abc123",
  "robot_id": "robot-001",
  "operator_did": "did:key:z6Mk...",
  "state": "active",
  "created_at": "2026-01-17T09:00:00Z",
  "expires_at": "2026-01-17T10:00:00Z",
  "effective_scope": ["drive", "camera"]
}
```

**States**: `pending`, `active`, `ended`, `revoked`

---

#### DELETE /v1/sessions/:session_id

End session (operator-initiated teardown).

**Response**: `204 No Content`

---

### Revocation

#### POST /v1/revocations

Revoke session(s) or operator access. Requires admin authorization.

**Request Body** (by session):
```json
{
  "session_id": "sess_abc123",
  "reason": "Policy violation detected"
}
```

**Request Body** (by operator):
```json
{
  "operator_did": "did:key:z6Mk...",
  "reason": "Operator credential revoked"
}
```

**Response**: `200 OK`
```json
{
  "revoked_sessions": ["sess_abc123"],
  "revoked_at": "2026-01-17T09:30:00Z"
}
```

---

### Audit

#### GET /v1/audit/events

Query audit events with filtering.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Filter by session |
| `robot_id` | string | Filter by robot |
| `actor_did` | string | Filter by operator DID |
| `event_type` | string | Filter by event type |
| `from` | ISO8601 | Start timestamp |
| `to` | ISO8601 | End timestamp |
| `page` | integer | Page number (default 1) |
| `page_size` | integer | Items per page (default 50, max 100) |

**Response**: `200 OK`
```json
{
  "events": [
    {
      "event_id": "evt_123",
      "timestamp": "2026-01-17T09:00:00Z",
      "event_type": "SESSION_GRANTED",
      "robot_id": "robot-001",
      "operator_did": "did:key:z6Mk...",
      "session_id": "sess_abc123",
      "metadata": {
        "effective_scope": ["drive", "camera"],
        "policy_hash": "sha256:abc..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_count": 142,
    "total_pages": 3
  }
}
```

---

### Key Distribution

#### GET /.well-known/jwks.json

Get public keys for token verification.

**Response**: `200 OK`
```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "kid": "gateway-signing-key-2026",
      "x": "<base64url-encoded-public-key>",
      "use": "sig",
      "alg": "EdDSA"
    }
  ]
}
```

---

## WebSocket Signaling

### Endpoint

```
wss://gateway.chainkvm.local:4000/v1/signal
```

### Connection

Connect with capability token in query parameter or header:

```
wss://gateway.chainkvm.local:4000/v1/signal?token=<capability_token>
```

### Message Format

All messages are JSON with a `type` field:

```json
{
  "type": "<message_type>",
  "payload": { ... }
}
```

### Client Messages

#### join

Join a session room.

```json
{
  "type": "join",
  "payload": {
    "session_id": "sess_abc123",
    "role": "console" | "robot"
  }
}
```

#### offer

Send SDP offer.

```json
{
  "type": "offer",
  "payload": {
    "session_id": "sess_abc123",
    "sdp": "<SDP offer>"
  }
}
```

#### answer

Send SDP answer.

```json
{
  "type": "answer",
  "payload": {
    "session_id": "sess_abc123",
    "sdp": "<SDP answer>"
  }
}
```

#### ice

Send ICE candidate.

```json
{
  "type": "ice",
  "payload": {
    "session_id": "sess_abc123",
    "candidate": {
      "candidate": "...",
      "sdpMid": "0",
      "sdpMLineIndex": 0
    }
  }
}
```

#### leave

Leave session room.

```json
{
  "type": "leave",
  "payload": {
    "session_id": "sess_abc123"
  }
}
```

### Server Messages

#### session_state

Session state notification.

```json
{
  "type": "session_state",
  "payload": {
    "session_id": "sess_abc123",
    "state": "active",
    "expires_at": "2026-01-17T10:00:00Z"
  }
}
```

#### revoked

Session revocation notification.

```json
{
  "type": "revoked",
  "payload": {
    "session_id": "sess_abc123",
    "reason": "Policy violation detected",
    "revoked_at": "2026-01-17T09:30:00Z"
  }
}
```

#### error

Error notification.

```json
{
  "type": "error",
  "payload": {
    "code": "UNAUTHORIZED",
    "message": "Token expired"
  }
}
```

---

## Capability Token Schema

The capability token is a JWT with EdDSA (Ed25519) signature.

### Header

```json
{
  "alg": "EdDSA",
  "typ": "JWT",
  "kid": "gateway-signing-key-2026"
}
```

### Payload

```json
{
  "iss": "gateway.chainkvm.local",
  "sub": "did:key:z6Mk...",
  "aud": "robot-001",
  "iat": 1705485600,
  "exp": 1705489200,
  "jti": "sess_abc123",
  "scope": ["drive", "camera"],
  "limits": {
    "max_control_rate_hz": 20,
    "max_video_bitrate_kbps": 4000
  }
}
```

### Claims

| Claim | Description |
|-------|-------------|
| `iss` | Gateway identifier |
| `sub` | Operator DID |
| `aud` | Target robot ID |
| `iat` | Token issued at (Unix timestamp) |
| `exp` | Token expiry (Unix timestamp) |
| `jti` | Session ID (unique token identifier) |
| `scope` | Authorized actions |
| `limits` | Rate and bandwidth limits |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request body |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `VC_VERIFICATION_FAILED` | 401 | VC signature invalid |
| `VC_EXPIRED` | 401 | VC has expired |
| `ISSUER_NOT_TRUSTED` | 401 | VC issuer not in trust list |
| `FORBIDDEN` | 403 | Policy denied access |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `SESSION_EXPIRED` | 410 | Session has expired |
| `SESSION_REVOKED` | 410 | Session was revoked |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
