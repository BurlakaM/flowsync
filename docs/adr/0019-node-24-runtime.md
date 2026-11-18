# 19. Runtime

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D19 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Node 24 LTS (or 22 if a dependency does not support 24)

## Alternatives considered and why not

Node 20 is EOL. Node 26 is already LTS (since November 2026), but CRA is not verified on it (the backend is already on Nest 12 / Prisma 6.19): return to it after phase 5
