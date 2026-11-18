# 5. Validation

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D5 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`class-validator` in DTOs + a global `ValidationPipe`; env via `zod`

## Alternatives considered and why not

`nestjs-zod`: needless DTO migration
