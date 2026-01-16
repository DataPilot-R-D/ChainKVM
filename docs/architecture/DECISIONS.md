# Architecture Decisions (POC Defaults)

This file records concrete choices so implementation can proceed without ambiguity. These are POC defaults; change only if a constraint requires it.

## Confirmed environment inputs

- **Robot platform:** Unitree Go2 Pro running **ROS 2** on **Ubuntu 22.04**.
- **Video source (POC start):** developer laptop/desktop **webcam** (“my computer camera”).
- **Ledger:** wire up **Hyperledger Fabric now** (no audit stub phase).
- **TURN:** run **coturn locally** for relay fallback in development.

## Protocols & topology

- **Transport:** WebRTC-only (SRTP video + DataChannel control), per PRD.
- **Topology:** P2P preferred; **TURN fallback** for NAT traversal; **no SFU** in POC (single operator + single robot).
- **Signaling:** WebSocket signaling served by the Gateway (`/v1/signal`) with token-based auth.

## Languages / stack (recommended)

- **Web Console:** TypeScript + React.
- **Gateway:** Node.js + TypeScript (single service: REST + signaling WS + policy/tokens + audit publisher).
- **Robot Agent:** Go using Pion WebRTC; video pipeline via GStreamer (typical) or platform camera source.
- **Ledger chaincode:** Go (Fabric chaincode), to keep packaging/runtime simple for a POC.

## Identity & crypto

- **DID method:** `did:key` for Operator and Robot (POC simplicity).
- **VC format:** JWT-based VC/VP (JWS) for simplest signature verification path in POC.
- **Capability token:** JWT/JWS signed by Gateway with **Ed25519 (JWS `alg=EdDSA`)**.
- **Key distribution:** Gateway exposes a JWKS endpoint (e.g., `GET /.well-known/jwks.json`); Robot Agent may also be provisioned with the Gateway public key for offline bootstrap.
- **Key rotation:** use `kid` in JWT header; Robot accepts current+previous `kid` during overlap.

## Policy

- **Policy model:** ordered ABAC rules in JSON, deterministic evaluation (first matching deny wins; else first allow; else default deny).
- **Policy hash:** canonical JSON (RFC 8785) + SHA-256; include `policy_id/version/hash` in audit events.
- **Policy updates (FR-13):** not implemented for single-Gateway POC; if running multiple Gateways, use Redis Pub/Sub to push `POLICY_UPDATED`.

## Revocation & safety

- **Revocation propagation:** push revoke to both peers via signaling; Robot safe-stops and closes PC; Gateway blocks session rejoin.
- **Re-auth on reconnect:** after DataChannel re-opens, Console must send `auth {sid, token}` again.
- **Control loss timeout:** default `500ms` (tune per robot dynamics); triggers safe-stop.
- **Target revoke latency:** p95 ≤ 1s (LAN), p95 ≤ 2s (WAN/TURN) from revoke accepted → robot safe-stop entered (measured).

## Audit & ledger

- **POC default audit scope:** session lifecycle + privileged actions only (no per-command events).
- **Event storage/indexing:** store events by composite keys enabling:
  - `session_id` ordered retrieval
  - time-range queries
  - optional secondary index by `operator_did`
- **Backpressure:** audit queue never blocks control; critical events buffered (bounded), non-critical events dropped/aggregated (but avoid logging them by default).

## Measurement output (POC)

- **Raw samples:** JSON Lines per session (easy append + later parse).
- **Exports:** JSON + CSV; simple static HTML report.
