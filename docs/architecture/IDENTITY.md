# Identity, Keys & Credential Bootstrapping (POC)

This document describes how identities and keys are created, trusted, and used in the POC.

## Actors and keys

- **Operator**
  - DID: `did:key:…`
  - Holds private key locally (device/browser side in POC; protect as best-effort).
- **Robot Agent**
  - DID: `did:key:…`
  - Holds private key on the robot compute.
- **Gateway**
  - Holds a signing key used to mint capability tokens.
  - Publishes the corresponding public key for Robot Agent verification.
- **VC Issuer (POC)**
  - Issues VCs/VPs for operator permissions.
  - Gateway trusts one (or a small set) of issuer public keys.

## DID method (POC)

Use `did:key` for simplicity:

- Public keys are embedded in the DID itself, so DID resolution is local/fast.
- Prefer Ed25519 for POC interoperability.

## VC/VP contents (minimum)

Claims needed to support PRD flows:

- `sub` / subject: operator DID
- role/permissions: `teleop:view`, `teleop:control`, `teleop:estop`
- scope constraints: allowed `robot_id` list (or robot group)
- expiry (`exp`) and issuer signature

## Trusted issuer configuration

Gateway maintains a static “trusted issuers” configuration (POC):

- issuer DID
- issuer public key
- allowed credential types

## Capability token signing and verification

### Signing

Gateway signs capability tokens (JWT/JWS) with:

- short TTL (`exp`)
- `sid` (session binding)
- `aud` (robot id)
- `scope` (effective allowed actions)
- `jti` (token id; useful for invalidation)

### Verification

Robot Agent verifies:

- signature against Gateway public key (or a small key set with `kid`)
- expiry
- `sid`/`aud` binding
- `scope` per message

## Gateway verification key distribution (JWKS)

POC default:

- Gateway exposes `GET /.well-known/jwks.json` containing its current (and previous) public verification keys.
- JWT header includes `kid`; Robot Agent selects the correct key from JWKS.
- For first-run bootstrap (offline), Robot Agent can be provisioned with the Gateway public key and later refreshed from JWKS.

## Key rotation (POC)

Keep rotation simple but explicit:

- Gateway can publish multiple verification keys (by `kid`) for overlap.
- Robot Agent accepts tokens signed by any currently-active `kid`.
- Rotation is manual in POC; document the procedure before demo.
