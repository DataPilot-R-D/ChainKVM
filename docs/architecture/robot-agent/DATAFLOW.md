# Robot Agent Data Flow

This document describes the data flow paths within the Robot Agent for video streaming and control command processing.

## Video Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Video Data Flow                                  │
└─────────────────────────────────────────────────────────────────────────┘

  Camera          Capture         Encoder         Track           Network
    │                │               │               │               │
    │   Raw frames   │               │               │               │
    ├───────────────▶│               │               │               │
    │   (V4L2/USB)   │   YUV/RGB    │               │               │
    │                ├──────────────▶│               │               │
    │                │               │   H.264 NAL  │               │
    │                │               ├──────────────▶│               │
    │                │               │               │   RTP/SRTP    │
    │                │               │               ├──────────────▶│
    │                │               │               │               │
    │◀ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─│◀ ─ ─ ─ ─ ─ ─ ┤  RTCP feedback │
    │  Bitrate adapt │               │   Rate ctrl  │               │
    │                │               │               │               │
```

### Video Pipeline Stages

1. **Camera Capture**
   - Source: V4L2 device, GStreamer pipeline, or platform camera
   - Output: Raw frames (YUV420, NV12, or RGB)
   - Rate: Configurable FPS (default 30)
   - Latency: < 10ms capture-to-buffer

2. **Video Encoder**
   - Input: Raw frames from capture
   - Codec: H.264 (preferred) or VP8
   - Profile: Baseline (H.264) for low latency
   - Output: Encoded NAL units
   - Features:
     - Hardware encoding when available
     - Bitrate adaptation based on RTCP feedback
     - Keyframe insertion for recovery

3. **WebRTC Video Track**
   - Input: Encoded frames
   - Protocol: RTP over DTLS-SRTP
   - Features:
     - Timestamp embedding for latency measurement
     - Sequence numbering for loss detection
     - RTCP feedback processing

### Video Latency Budget

| Stage | Target | Notes |
|-------|--------|-------|
| Capture | < 10ms | Frame acquisition |
| Encode | < 20ms | Hardware preferred |
| Packetize | < 5ms | RTP packaging |
| Network | Variable | LAN ~2ms, WAN ~50ms |
| **Total Robot-side** | **< 35ms** | Encode + packetize |

## Control Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Control Command Flow                               │
└─────────────────────────────────────────────────────────────────────────┘

  DataChannel      Validator       RateLimiter     Dispatcher      Robot
       │               │               │               │             │
       │   JSON msg    │               │               │             │
       ├──────────────▶│               │               │             │
       │               │  Valid msg    │               │             │
       │               ├──────────────▶│               │             │
       │               │               │  Allowed msg  │             │
       │               │               ├──────────────▶│             │
       │               │               │               │  Robot API  │
       │               │               │               ├────────────▶│
       │               │               │               │             │
       │◀──────────────┤               │               │             │
       │   ack/err     │               │               │             │
       │               │               │               │             │

  Error Paths:
       │               │               │               │             │
       │   Invalid     │               │               │             │
       ├──────────────▶│───▶ Safety Monitor ───▶ Safe-Stop          │
       │               │   (if threshold)                            │
       │               │               │               │             │
       │               │   Rate limit  │               │             │
       │               ├──────────────▶│───▶ Drop + warn             │
       │               │               │               │             │
```

### Control Pipeline Stages

1. **DataChannel Reception**
   - Protocol: WebRTC DataChannel (SCTP over DTLS)
   - Mode: Unreliable, unordered (low latency)
   - Format: JSON messages

2. **Message Validator**
   - Schema validation (type, required fields)
   - Timestamp validation (reject stale commands)
   - Scope check (command type allowed by token)
   - Invalid count tracking for safety

3. **Rate Limiter**
   - Per-command-type limits
   - Token bucket algorithm
   - Dropped messages logged (not errors)

4. **Command Dispatcher**
   - Routes to appropriate robot API
   - Executes command atomically
   - Returns acknowledgment or error

### Control Message Types

| Type | Fields | Rate Limit | Scope Required |
|------|--------|------------|----------------|
| `drive` | `v, w, t` | 50 Hz | `teleop:control` |
| `kvm_key` | `key, action, t` | 100 Hz | `teleop:control` |
| `kvm_mouse` | `dx, dy, buttons, t` | 100 Hz | `teleop:control` |
| `e_stop` | `t` | 10 Hz | `teleop:estop` |
| `ping` | `seq, t_mono` | 20 Hz | `teleop:view` |

### Control Latency Budget

| Stage | Target | Notes |
|-------|--------|-------|
| DataChannel | < 5ms | SCTP delivery |
| Validate | < 1ms | In-memory checks |
| Rate check | < 0.1ms | Token bucket |
| Dispatch | < 2ms | API call |
| **Total** | **< 10ms** | Processing only |

## Safety Monitoring Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Safety Monitoring Flow                              │
└─────────────────────────────────────────────────────────────────────────┘

  Sources                    Monitor                         Actions
     │                          │                               │
     │                          │                               │
  E-Stop ──────────────────────▶├─────────────────────────────▶ Safe-Stop
     │                          │                               │
     │                          │                               │
  Control Loss ────────────────▶├─────────────────────────────▶ Safe-Stop
  (timeout)                     │                               │
     │                          │                               │
     │                          │                               │
  Invalid Cmds ────────────────▶├─────────────────────────────▶ Safe-Stop
  (threshold)                   │                               │
     │                          │                               │
     │                          │                               │
  Token Expired ───────────────▶├─────────────────────────────▶ Safe-Stop
     │                          │                               │
     │                          │                               │
  Revocation ──────────────────▶├─────────────────────────────▶ Safe-Stop
  (from Gateway)                │                               │
```

### Safety Triggers

| Trigger | Detection | Response Time |
|---------|-----------|---------------|
| E-Stop command | Immediate on receipt | < 10ms |
| Control loss | No message for 500ms | < 510ms |
| Invalid commands | 10 consecutive | < 100ms |
| Token expiry | Periodic check (100ms) | < 100ms |
| Revocation | Signaling message | < 100ms |

## Audit Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Audit Event Flow (Async)                            │
└─────────────────────────────────────────────────────────────────────────┘

  Event Source             Queue                  Publisher          Gateway
       │                     │                        │                  │
       │   E-Stop event      │                        │                  │
       ├────────────────────▶│                        │                  │
       │                     │   Batch (async)        │                  │
       │                     ├───────────────────────▶│                  │
       │                     │                        │   HTTP POST      │
       │                     │                        ├─────────────────▶│
       │                     │                        │                  │
       │                     │◀──────────────────────┤   ACK            │
       │                     │        Confirm         │◀─────────────────┤
       │                     │                        │                  │
```

### Audit Events from Robot Agent

| Event | Trigger | Priority |
|-------|---------|----------|
| `PRIVILEGED_ACTION:E_STOP` | E-stop executed | Critical |
| `PRIVILEGED_ACTION:SAFE_STOP` | Safe-stop triggered | Critical |
| `SESSION_STARTED` | First valid control | Normal |
| `SESSION_ENDED` | Clean disconnect | Normal |

Audit publishing is always asynchronous and never blocks control operations.
