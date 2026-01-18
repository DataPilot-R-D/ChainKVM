# TURN Server Infrastructure

coturn configuration for WebRTC relay fallback when P2P fails due to NAT.

## Prerequisites

- Docker (recommended) or coturn installed locally
- Open UDP ports 3478 (TURN) and 49152-65535 (relay range)

## Quick Start (Docker)

```bash
# Start coturn with default config
docker-compose up -d

# Check logs
docker-compose logs -f coturn

# Stop
docker-compose down
```

## Quick Start (Local)

```bash
# macOS
brew install coturn
turnserver -c turnserver.conf

# Ubuntu
sudo apt install coturn
sudo turnserver -c turnserver.conf
```

## Configuration

Edit `turnserver.conf` for your environment:

| Setting | Default | Description |
|---------|---------|-------------|
| `listening-port` | 3478 | TURN listening port |
| `realm` | chainkvm.local | Authentication realm |
| `static-auth-secret` | (dev only) | Shared secret for TURN credentials |

## Gateway Integration

The Gateway generates time-limited TURN credentials using the shared secret:

```typescript
// TURN credential generation (RFC 5389)
const username = `${timestamp}:${userId}`;
const credential = hmacSha1(secret, username);
```

## Testing

```bash
# Test TURN connectivity
turnutils_uclient -T -u testuser -w testpass localhost
```

## Security Notes

- **Production**: Use TLS (port 5349) and proper certificate
- **Production**: Generate unique per-session credentials
- **POC**: Static credentials are acceptable for development
