# 21. Logging and API protection

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D21 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`nestjs-pino` (JSON in production, pretty in dev, tokens redacted), `helmet`, `@nestjs/throttler` (100/min globally, 5/min for login and registration), `TRUST_PROXY` behind nginx

## Alternatives considered and why not

A custom logger/middleware: duplicates what already exists
