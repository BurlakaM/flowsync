# 23. Migrations

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D23 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`prisma migrate` (SQL in the repository), `migrate deploy` on start in Docker; CI checks for drift between schema and migrations

## Alternatives considered and why not

`db push`: leaves no history and is dangerous for data
