# 32. Real-time

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D32 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`@nestjs/websockets` + `socket.io` under `/api/socket.io` (the same proxy as the API); authorization by a token in the handshake, rooms by access; events only announce a change, the client fetches data through the API

## Alternatives considered and why not

SSE (one-directional, but a separate route); sending full data in events (leakage, duplicated permissions)

## Consequences

- An event says "something changed here", the client fetches data through the API, so the socket never bypasses permissions.
- Several API instances need a Redis adapter (ADR 40).

## When to revisit

If clients need the data itself in the event (large boards), send minimal diffs after checking permissions rather than whole entities.
