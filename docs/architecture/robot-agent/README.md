# Robot Agent Architecture

The Robot Agent is the edge component that runs on or near the robot. It handles video streaming, control command execution, capability token validation, and safety enforcement.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Robot Agent (Go)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Video Module │  │Control Module│  │   Session Manager     │ │
│  │  (capture +  │  │  (validate + │  │ (token + state + WS)  │ │
│  │   encode)    │  │   dispatch)  │  │                       │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         │                 │                      │             │
│         ▼                 ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               WebRTC Transport (Pion)                   │   │
│  │    SRTP (video out)  │  DataChannel (control in/out)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                │                               │
│  ┌─────────────────────────────┴───────────────────────────┐   │
│  │                Safety Subsystem                         │   │
│  │   E-Stop │ Control Loss Detection │ Rate Limiter        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Safety is local**: E-stop and safe-stop execute without network round-trips.
2. **Control path is fast**: No blockchain, no Gateway calls during runtime control.
3. **Token-gated access**: All control requires a valid, non-expired capability token.
4. **Fail-safe defaults**: Unknown states or errors trigger safe-stop.

## Components

### 1. Video Module

Captures video from camera source, encodes to H.264/VP8, and feeds the WebRTC track.

**Responsibilities:**
- Camera device access (V4L2, GStreamer, or platform-specific)
- Hardware or software encoding (H.264 preferred for latency)
- Frame rate and bitrate adaptation based on network conditions
- Timestamp embedding for latency measurement

**Interfaces:**
- Input: Camera device (configurable path/source)
- Output: Encoded video frames to WebRTC track

### 2. Control Module

Receives control messages from DataChannel, validates, and dispatches to robot APIs.

**Responsibilities:**
- Parse and validate control message schema
- Check rate limits per command type
- Dispatch to appropriate robot API (drive, KVM input, e-stop)
- Track invalid command count for safety triggers

**Command Types:**
- `drive(v, w, t)`: Linear/angular velocity for mobile base
- `kvm_key(key, action, t)`: Keyboard input simulation
- `kvm_mouse(dx, dy, buttons, t)`: Mouse input simulation
- `e_stop(t)`: Emergency stop (privileged action)

### 3. Session Manager

Handles WebRTC peer connection lifecycle, signaling, and token validation.

**Responsibilities:**
- Connect to Gateway signaling (WebSocket)
- Exchange SDP/ICE for WebRTC establishment
- Validate capability tokens (JWT signature, expiry, scope)
- Manage session state machine
- Handle reconnection and re-authentication

### 4. Safety Subsystem

Monitors for conditions requiring safe-stop and executes transitions.

**Triggers:**
- Explicit E-stop command
- Control channel loss (DataChannel closed or timeout)
- Invalid command threshold exceeded
- Token expiry during session
- Revocation signal from Gateway

**Safe-Stop Behavior:**
- Immediately halt all robot motion
- Close WebRTC connection
- Transition to Idle state
- Log privileged action if applicable

## State Machine

```
         ┌──────────────────────────────────────────┐
         │                                          │
         ▼                                          │
    ┌─────────┐    auth success     ┌─────────┐    │
    │  Idle   │ ──────────────────▶ │  Active │    │
    └─────────┘                     └────┬────┘    │
         ▲                               │         │
         │                               │         │
         │     ┌────────────────────┐    │         │
         │     │                    │    │         │
         │     │  • E-Stop          │    │         │
         └─────│  • Control loss    │◀───┘         │
   reset/end   │  • Invalid cmds    │              │
               │  • Token expired   │              │
               │  • Revoked         │              │
               └────────────────────┘              │
                      SafeStop                     │
                         │                         │
                         └─────────────────────────┘
```

**States:**
- **Idle**: No active session; waiting for connection
- **Active**: Authorized session; accepting control commands
- **SafeStop**: Safety triggered; motion halted; cleaning up

## Security Boundaries

### Trusted
- Local safety path (hardcoded, always executes)
- Robot hardware APIs (direct access)
- Gateway public key (provisioned at deploy)

### Untrusted
- All incoming DataChannel messages (must validate)
- Capability tokens (must verify signature and expiry)
- Signaling messages (used for SDP/ICE only, not authorization)

### Token Validation Rules

1. Verify JWT signature using Gateway public key (Ed25519)
2. Check `exp` is in the future
3. Check `aud` matches this robot's ID
4. Check `sid` matches the current session
5. Check `scope` includes required permission for command type

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ROBOT_ID` | - | Unique robot identifier (DID) |
| `GATEWAY_WS_URL` | - | Gateway signaling WebSocket URL |
| `GATEWAY_JWKS_URL` | - | Gateway JWKS endpoint for token verification |
| `CAMERA_DEVICE` | `/dev/video0` | Camera device path |
| `VIDEO_CODEC` | `h264` | Video codec (h264, vp8) |
| `VIDEO_BITRATE` | `2000000` | Target bitrate in bps |
| `VIDEO_FPS` | `30` | Target frame rate |
| `CONTROL_LOSS_TIMEOUT_MS` | `500` | Timeout before safe-stop |
| `RATE_LIMIT_DRIVE_HZ` | `50` | Max drive commands per second |
| `RATE_LIMIT_KVM_HZ` | `100` | Max KVM events per second |
| `INVALID_CMD_THRESHOLD` | `10` | Invalid commands before safe-stop |
| `STUN_SERVERS` | - | STUN server URLs (comma-separated) |
| `TURN_SERVERS` | - | TURN server URLs (comma-separated) |

## Performance Targets

| Metric | LAN Target | WAN Target |
|--------|------------|------------|
| Control RTT | p50 ≤ 50ms | p50 ≤ 150ms |
| Video latency | p50 ≤ 200ms | p50 ≤ 400ms |
| Control rate | ≥ 20 Hz sustained | ≥ 20 Hz sustained |

## Resource Requirements (POC)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 512 MB | 1 GB |
| Network | 5 Mbps up | 10 Mbps up |
| OS | Linux (Ubuntu 22.04) | Linux (Ubuntu 22.04) |

## Directory Structure

```
robot-agent/
├── cmd/
│   └── agent/
│       └── main.go           # Entry point
├── internal/
│   ├── video/
│   │   ├── capture.go        # Camera capture
│   │   └── encoder.go        # Video encoding
│   ├── control/
│   │   ├── handler.go        # Command dispatch
│   │   ├── validator.go      # Message validation
│   │   └── ratelimit.go      # Rate limiting
│   ├── session/
│   │   ├── manager.go        # Session lifecycle
│   │   ├── signaling.go      # WebSocket signaling
│   │   └── token.go          # JWT validation
│   ├── safety/
│   │   ├── monitor.go        # Safety trigger monitoring
│   │   └── safestop.go       # Safe-stop execution
│   └── transport/
│       ├── webrtc.go         # Pion WebRTC setup
│       └── datachannel.go    # DataChannel handling
├── pkg/
│   └── protocol/
│       └── messages.go       # Control message schemas
├── config/
│   └── config.go             # Configuration loading
└── go.mod
```

## Related Documents

- [Data Flow Diagrams](./DATAFLOW.md)
- [API Contracts](./API.md)
- [Parent Architecture](../README.md)
- [Security Architecture](../SECURITY.md)
- [Reliability](../RELIABILITY.md)
