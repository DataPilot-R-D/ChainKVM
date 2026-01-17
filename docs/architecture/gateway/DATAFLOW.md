# Gateway Data Flows

This document describes the key data flows through the Gateway component.

## Session Establishment Flow

```
Console                    Gateway                    Robot Agent
   │                          │                           │
   │  1. POST /v1/sessions    │                           │
   │  {robot_id, vc_or_vp}    │                           │
   │─────────────────────────>│                           │
   │                          │                           │
   │                    ┌─────┴─────┐                     │
   │                    │ Verify VC │                     │
   │                    │ signature │                     │
   │                    └─────┬─────┘                     │
   │                          │                           │
   │                    ┌─────┴─────┐                     │
   │                    │ Evaluate  │                     │
   │                    │  policy   │                     │
   │                    └─────┬─────┘                     │
   │                          │                           │
   │                    ┌─────┴─────┐                     │
   │                    │  Issue    │                     │
   │                    │  token    │                     │
   │                    └─────┬─────┘                     │
   │                          │                           │
   │  2. {session_id, token,  │                           │
   │      signaling_url, ...} │                           │
   │<─────────────────────────│                           │
   │                          │                           │
   │  3. WS connect /v1/signal│                           │
   │─────────────────────────>│                           │
   │                          │<──────────────────────────│
   │                          │  4. WS connect /v1/signal │
   │                          │     (role=robot)          │
   │                          │                           │
   │  5. join {session_id}    │                           │
   │─────────────────────────>│                           │
   │                          │<──────────────────────────│
   │                          │  6. join {session_id}     │
   │                          │                           │
   │  7. offer {sdp}          │                           │
   │─────────────────────────>│                           │
   │                          │───────────────────────────>│
   │                          │  8. offer {sdp}           │
   │                          │                           │
   │                          │<──────────────────────────│
   │                          │  9. answer {sdp}          │
   │<─────────────────────────│                           │
   │  10. answer {sdp}        │                           │
   │                          │                           │
   │  11. ice {candidate}     │                           │
   │─────────────────────────>│<──────────────────────────│
   │<─────────────────────────│  12. ice {candidate}      │
   │                          │                           │
   │                          │                           │
   ╔══════════════════════════╧═══════════════════════════╗
   ║         WebRTC P2P Connection Established            ║
   ╚══════════════════════════╤═══════════════════════════╝
   │                          │                           │
   │  DataChannel: auth       │                           │
   │  {session_id, token}     │                           │
   │──────────────────────────┼──────────────────────────>│
   │                          │                           │
   │                          │             ┌─────────────┴─┐
   │                          │             │ Validate token│
   │                          │             │ via JWKS      │
   │                          │             └─────────────┬─┘
   │                          │                           │
   │  DataChannel: auth_ok    │                           │
   │  {scope, expires_at}     │                           │
   │<─────────────────────────┼───────────────────────────│
   │                          │                           │
```

## Revocation Flow

```
Admin                      Gateway                    Console/Robot
   │                          │                           │
   │  POST /v1/revocations    │                           │
   │  {session_id, reason}    │                           │
   │─────────────────────────>│                           │
   │                          │                           │
   │                    ┌─────┴─────┐                     │
   │                    │  Update   │                     │
   │                    │revocation │                     │
   │                    │  cache    │                     │
   │                    └─────┬─────┘                     │
   │                          │                           │
   │                    ┌─────┴─────┐                     │
   │                    │   Mark    │                     │
   │                    │ session   │                     │
   │                    │ revoked   │                     │
   │                    └─────┬─────┘                     │
   │                          │                           │
   │  {revoked_sessions}      │                           │
   │<─────────────────────────│                           │
   │                          │                           │
   │                          │  WS: revoked              │
   │                          │  {session_id, reason}     │
   │                          │───────────────────────────>│
   │                          │                           │
   │                          │             ┌─────────────┴─┐
   │                          │             │ Robot: enter  │
   │                          │             │ safe-stop     │
   │                          │             │               │
   │                          │             │ Console: UI   │
   │                          │             │ disabled      │
   │                          │             └───────────────┘
   │                          │                           │
   │                    ┌─────┴─────┐                     │
   │                    │  Async:   │                     │
   │                    │  publish  │                     │
   │                    │  to Fabric│                     │
   │                    └───────────┘                     │
```

## Audit Publishing Flow

```
                          Gateway
                             │
   Control Flow              │              Audit Queue
       │                     │                   │
       │   [Session event]   │                   │
       │────────────────────>│                   │
       │                     │                   │
       │              ┌──────┴──────┐            │
       │              │ Process     │            │
       │              │ event       │            │
       │              └──────┬──────┘            │
       │                     │                   │
       │                     │  Enqueue event    │
       │                     │──────────────────>│
       │                     │                   │
       │   [Response]        │                   │
       │<────────────────────│                   │
       │                     │                   │
       │   (control path     │                   │
       │    not blocked)     │                   │
                             │                   │
                             │     ┌─────────────┴────┐
                             │     │ Audit Consumer   │
                             │     │ (async worker)   │
                             │     └─────────────┬────┘
                             │                   │
                             │                   │  Batch events
                             │                   │─────────────────>  Fabric
                             │                   │
                             │                   │  [Ack/Retry]
                             │                   │<─────────────────  Fabric
```

## Token Validation Flow (at Robot Agent)

```
                    Robot Agent
                         │
   DataChannel           │              JWKS Cache
   (from Console)        │                   │
       │                 │                   │
       │  auth {token}   │                   │
       │────────────────>│                   │
       │                 │                   │
       │           ┌─────┴─────┐             │
       │           │ Parse JWT │             │
       │           │ header    │             │
       │           └─────┬─────┘             │
       │                 │                   │
       │                 │  Get key by kid   │
       │                 │──────────────────>│
       │                 │                   │
       │                 │   [Cache hit?]    │
       │                 │<──────────────────│
       │                 │                   │
       │                 │  (Cache miss: fetch from Gateway)
       │                 │───────────────────────────────────> Gateway
       │                 │<─────────────────────────────────── JWKS
       │                 │                   │
       │           ┌─────┴─────┐             │
       │           │ Verify    │             │
       │           │ signature │             │
       │           └─────┬─────┘             │
       │                 │                   │
       │           ┌─────┴─────┐             │
       │           │ Check     │             │
       │           │ claims:   │             │
       │           │ - exp     │             │
       │           │ - aud     │             │
       │           │ - scope   │             │
       │           └─────┬─────┘             │
       │                 │                   │
       │  auth_ok        │                   │
       │<────────────────│                   │
       │                 │                   │
       │  [Control flow  │                   │
       │   now active]   │                   │
```

## Policy Evaluation Flow

```
                          Gateway
                             │
   Session Request           │           Policy Store
       │                     │                │
       │  {operator_did,     │                │
       │   robot_id, scope}  │                │
       │────────────────────>│                │
       │                     │                │
       │                     │  Load policy   │
       │                     │  snapshot      │
       │                     │───────────────>│
       │                     │                │
       │                     │  {rules, ver}  │
       │                     │<───────────────│
       │                     │                │
       │              ┌──────┴──────┐         │
       │              │ Build       │         │
       │              │ context:    │         │
       │              │ - operator  │         │
       │              │ - robot     │         │
       │              │ - time      │         │
       │              │ - scope     │         │
       │              └──────┬──────┘         │
       │                     │                │
       │              ┌──────┴──────┐         │
       │              │ Evaluate    │         │
       │              │ rules in    │         │
       │              │ order:      │         │
       │              │             │         │
       │              │ for rule:   │         │
       │              │   if match: │         │
       │              │     return  │         │
       │              │     decision│         │
       │              │             │         │
       │              │ default:    │         │
       │              │   DENY      │         │
       │              └──────┬──────┘         │
       │                     │                │
       │  Decision:          │                │
       │  {allow/deny,       │                │
       │   effective_scope,  │                │
       │   reasons}          │                │
       │<────────────────────│                │
```

## Session State Machine

```
                    ┌───────────┐
                    │  PENDING  │
                    └─────┬─────┘
                          │
               [VC verified + policy allows]
                          │
                          ▼
                    ┌───────────┐
              ┌────>│  ACTIVE   │<────┐
              │     └─────┬─────┘     │
              │           │           │
    [Reconnect OK]        │     [Token refresh]
              │           │           │
              │     ┌─────┴─────┐     │
              │     │           │     │
              │     ▼           ▼     │
         ┌────┴────┐       ┌────┴────┐
         │DISCONN- │       │ REVOKED │
         │  ECTED  │       └─────────┘
         └────┬────┘             │
              │                  │
    [Timeout / │           [No recovery]
     No reconnect]               │
              │                  ▼
              ▼            ┌─────────┐
         ┌─────────┐       │  ENDED  │
         │  ENDED  │       └─────────┘
         └─────────┘
```

## Audit Event Lifecycle

```
Event Created           Queue              Consumer            Fabric
      │                   │                    │                  │
      │  SESSION_GRANTED  │                    │                  │
      │──────────────────>│                    │                  │
      │                   │                    │                  │
      │  SESSION_STARTED  │                    │                  │
      │──────────────────>│                    │                  │
      │                   │                    │                  │
      │                   │  Dequeue batch     │                  │
      │                   │───────────────────>│                  │
      │                   │                    │                  │
      │                   │                    │  Submit batch    │
      │                   │                    │─────────────────>│
      │                   │                    │                  │
      │                   │                    │  [Commit OK]     │
      │                   │                    │<─────────────────│
      │                   │                    │                  │
      │                   │  Ack batch         │                  │
      │                   │<───────────────────│                  │
      │                   │                    │                  │
      │  SESSION_REVOKED  │                    │                  │
      │──────────────────>│                    │                  │
      │                   │  ...               │                  │
```
