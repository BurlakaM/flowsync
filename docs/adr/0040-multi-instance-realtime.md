# 40. Real-time across several instances

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D40 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`@socket.io/redis-adapter` only with `REDIS_URL`, wired in `main.ts`; without Redis — a single instance

## Alternatives considered and why not

Sticky sessions without an adapter (events are still lost between instances); a custom bus
