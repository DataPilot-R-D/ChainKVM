# Robot Agent API Contracts

This document defines the message protocols and API contracts for the Robot Agent.

## DataChannel Protocol

All DataChannel messages are JSON-encoded with a required `type` field.

### Authentication Messages

#### `auth` (Console → Robot)

First message after DataChannel opens. Must be sent before control is accepted.

```json
{
  "type": "auth",
  "session_id": "string",
  "token": "string (JWT)"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Must be `"auth"` |
| `session_id` | string | yes | Session ID from Gateway |
| `token` | string | yes | JWT capability token |

#### `auth_ok` (Robot → Console)

Sent when authentication succeeds.

```json
{
  "type": "auth_ok",
  "session_id": "string",
  "robot_id": "string",
  "scope": ["string"],
  "expires_at": "number (unix ms)"
}
```

#### `auth_err` (Robot → Console)

Sent when authentication fails.

```json
{
  "type": "auth_err",
  "code": "string",
  "reason": "string"
}
```

| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | JWT signature invalid or malformed |
| `TOKEN_EXPIRED` | Token `exp` is in the past |
| `WRONG_AUDIENCE` | Token `aud` doesn't match robot ID |
| `SESSION_MISMATCH` | Token `sid` doesn't match session |
| `INSUFFICIENT_SCOPE` | Required scope missing |

### Control Messages

All control messages include a timestamp `t` (monotonic, milliseconds) for staleness detection and latency measurement.

#### `drive` (Console → Robot)

Mobile base velocity command.

```json
{
  "type": "drive",
  "v": "number",
  "w": "number",
  "t": "number"
}
```

| Field | Type | Range | Unit | Description |
|-------|------|-------|------|-------------|
| `v` | number | -1.0 to 1.0 | normalized | Linear velocity |
| `w` | number | -1.0 to 1.0 | normalized | Angular velocity |
| `t` | number | > 0 | ms | Sender timestamp |

**Scope required:** `teleop:control`
**Rate limit:** 50 Hz

#### `kvm_key` (Console → Robot)

Keyboard input event.

```json
{
  "type": "kvm_key",
  "key": "string",
  "action": "string",
  "modifiers": ["string"],
  "t": "number"
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `key` | string | Key code | Key identifier (e.g., "KeyA", "Enter") |
| `action` | string | `"down"`, `"up"` | Key press or release |
| `modifiers` | array | `["ctrl", "alt", "shift", "meta"]` | Active modifiers |
| `t` | number | > 0 | Sender timestamp (ms) |

**Scope required:** `teleop:control`
**Rate limit:** 100 Hz

#### `kvm_mouse` (Console → Robot)

Mouse input event.

```json
{
  "type": "kvm_mouse",
  "dx": "number",
  "dy": "number",
  "buttons": "number",
  "scroll": "number",
  "t": "number"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `dx` | number | Relative X movement (pixels) |
| `dy` | number | Relative Y movement (pixels) |
| `buttons` | number | Button bitmask (bit 0=left, 1=right, 2=middle) |
| `scroll` | number | Scroll delta (positive=up, negative=down) |
| `t` | number | Sender timestamp (ms) |

**Scope required:** `teleop:control`
**Rate limit:** 100 Hz

#### `e_stop` (Console → Robot)

Emergency stop command. Immediately halts all motion.

```json
{
  "type": "e_stop",
  "t": "number"
}
```

**Scope required:** `teleop:estop`
**Rate limit:** 10 Hz
**Priority:** Highest (bypasses rate limiter)

### Measurement Messages

#### `ping` (Console → Robot)

RTT measurement probe.

```json
{
  "type": "ping",
  "seq": "number",
  "t_mono": "number"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `seq` | number | Sequence number (wraps at 2^32) |
| `t_mono` | number | Monotonic timestamp (ms) |

**Scope required:** `teleop:view`
**Rate limit:** 20 Hz

#### `pong` (Robot → Console)

RTT measurement response.

```json
{
  "type": "pong",
  "seq": "number",
  "t_mono": "number",
  "t_recv": "number"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `seq` | number | Echo of ping sequence |
| `t_mono` | number | Echo of ping timestamp |
| `t_recv` | number | Robot receive timestamp (ms) |

### Acknowledgment Messages

#### `ack` (Robot → Console)

Command acknowledged and executed.

```json
{
  "type": "ack",
  "ref_type": "string",
  "ref_t": "number"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ref_type` | string | Type of acknowledged message |
| `ref_t` | number | Timestamp of acknowledged message |

#### `error` (Robot → Console)

Command rejected.

```json
{
  "type": "error",
  "code": "string",
  "reason": "string",
  "ref_type": "string",
  "ref_t": "number"
}
```

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Malformed JSON or missing fields |
| `UNKNOWN_TYPE` | Unrecognized message type |
| `STALE_COMMAND` | Timestamp too old (> 500ms) |
| `RATE_LIMITED` | Rate limit exceeded |
| `UNAUTHORIZED` | Not authenticated or wrong scope |
| `SAFE_STOPPED` | Robot in safe-stop state |

### State Messages

#### `state` (Robot → Console)

Periodic state update (optional, for UI).

```json
{
  "type": "state",
  "robot_state": "string",
  "session_state": "string",
  "t": "number"
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `robot_state` | `"idle"`, `"active"`, `"safe_stop"` | Robot state |
| `session_state` | `"connected"`, `"authenticated"` | Session state |

## Capability Token (JWT)

The Robot Agent validates JWT capability tokens issued by the Gateway.

### Token Structure

```
Header:
{
  "alg": "EdDSA",
  "typ": "JWT",
  "kid": "gateway-key-001"
}

Payload:
{
  "sub": "did:key:z6Mk...",
  "aud": "did:key:z6Mk...",
  "sid": "session-uuid",
  "scope": ["teleop:view", "teleop:control", "teleop:estop"],
  "exp": 1705432800,
  "iat": 1705432500,
  "nonce": "random-string",
  "jti": "token-id"
}
```

### Claims

| Claim | Type | Required | Description |
|-------|------|----------|-------------|
| `sub` | string | yes | Operator DID |
| `aud` | string | yes | Robot ID (must match this robot) |
| `sid` | string | yes | Session ID (must match current session) |
| `scope` | array | yes | Allowed action scopes |
| `exp` | number | yes | Expiry timestamp (unix seconds) |
| `iat` | number | no | Issued at timestamp |
| `nonce` | string | yes | Random binding value |
| `jti` | string | no | Token ID (for revocation) |

### Scopes

| Scope | Description | Required For |
|-------|-------------|--------------|
| `teleop:view` | View video stream | `ping` |
| `teleop:control` | Send control commands | `drive`, `kvm_*` |
| `teleop:estop` | Send emergency stop | `e_stop` |

### Validation Steps

1. Parse JWT header and payload
2. Verify signature using Gateway public key (from JWKS)
3. Check `exp > now`
4. Check `aud == ROBOT_ID`
5. Check `sid == current_session_id`
6. For each command, check required scope in `scope` array

## Signaling Protocol

Connection to Gateway signaling WebSocket for SDP/ICE exchange.

### Connection

```
wss://gateway.example.com/v1/signal?token=<signaling_token>
```

### Messages

Robot Agent handles these signaling message types:

#### `join` (Robot → Gateway)

```json
{
  "type": "join",
  "session_id": "string",
  "role": "robot"
}
```

#### `offer` (Gateway → Robot)

```json
{
  "type": "offer",
  "session_id": "string",
  "sdp": "string"
}
```

#### `answer` (Robot → Gateway)

```json
{
  "type": "answer",
  "session_id": "string",
  "sdp": "string"
}
```

#### `ice` (Bidirectional)

```json
{
  "type": "ice",
  "session_id": "string",
  "candidate": "string"
}
```

#### `revoked` (Gateway → Robot)

```json
{
  "type": "revoked",
  "session_id": "string",
  "reason": "string"
}
```

Robot must immediately transition to safe-stop on receiving this message.

## Error Handling

### Validation Errors

- Invalid JSON: Log error, increment invalid count
- Unknown type: Log warning, send `error` response
- Missing required field: Send `error` response
- Out of range value: Clamp or send `error` response

### Safety Errors

- Invalid command threshold (10): Trigger safe-stop
- Control loss timeout (500ms): Trigger safe-stop
- Token expiry: Trigger safe-stop

### Network Errors

- DataChannel close: Trigger safe-stop
- Signaling disconnect: Attempt reconnect, safe-stop if fails
