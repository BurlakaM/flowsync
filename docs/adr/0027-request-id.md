# 27. Request id

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D27 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`X-Request-Id` via `genReqId` in `nestjs-pino` (the incoming header if it looks like an id, otherwise a UUID) and a `requestId` field in the error body

## Alternatives considered and why not

`nestjs-cls`: a separate dependency with no benefit while the id is only needed by logs and the response
