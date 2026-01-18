# Robot Agent

Go-based agent running on the robot, handling video streaming, control execution, and safety enforcement.

## Stack

- Go 1.22+
- Pion WebRTC for P2P transport
- GStreamer for video pipeline (optional, for hardware encoding)

## Development

```bash
# Download dependencies
go mod download

# Run agent
go run ./cmd/agent

# Run tests
go test ./...

# Build binary
go build -o bin/robot-agent ./cmd/agent
```

## Structure

```
cmd/agent/      - Entry point
internal/
  capture/      - Video capture (webcam/GStreamer)
  control/      - Control command handling
  safety/       - Safe-state enforcement
  session/      - WebRTC session management
  token/        - Capability token validation
```

## Environment

```bash
GATEWAY_URL=http://localhost:4000
STUN_URL=stun:stun.l.google.com:19302
TURN_URL=turn:localhost:3478
TURN_USER=robot
TURN_PASS=<turn-credential>
CONTROL_LOSS_TIMEOUT_MS=500
```

## Video Sources

The agent supports multiple video sources:

1. **Webcam (default)**: `/dev/video0` on Linux, system camera on macOS
2. **GStreamer pipeline**: For hardware encoding or custom sources
3. **Test pattern**: For development without hardware
