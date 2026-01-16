# Observability & Measurement (POC)

This document outlines how to meet PRD measurement requirements and the M6 roadmap tasks without impacting control-path latency.

Reference: `docs/architecture/diagrams/07-observability-measurement.mmd`

## Metrics to collect

From `PRD.md`:

- Session setup duration (with phase breakdown)
- Control RTT (DataChannel ping/pong)
- Video E2E latency (timestamp overlay)
- Bitrate, packet loss, jitter (WebRTC `getStats()`)
- Revocation propagation delay

## Instrumentation points

- **Gateway**
  - session request start/end timestamps
  - VC verification time, policy evaluation time, token issuance time
  - revocation trigger → termination completion time
- **Web Console**
  - ICE negotiation time, peer connection time
  - first decoded video frame time
  - control RTT samples (ping/pong)
  - periodic `getStats()` sampling
- **Robot Agent**
  - timestamp overlay at capture time for video latency measurement
  - control receive rate (Hz) and drop detection

## Data handling

- Store raw samples per session (time series) plus aggregated summaries.
- Prefer monotonic clocks for RTT and phase measurements; handle wall-clock offsets for video latency (relative-delta method when needed).

## Aggregation & reporting

- Compute p50/p95/p99 plus min/max/mean/stddev per session and across runs.
- Produce machine-readable exports (JSON/CSV) and a simple HTML report template (future M6 tasks).

## Repeatable scenarios

- Define test scenarios in config (YAML/JSON) and drive automated session lifecycle + simulated control patterns to reduce flakiness.

