# 20. TypeScript

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D20 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`~6.0` with `strict: true`: `@nestjs/schematics@12` requires ≥ 6, and `typescript-eslint` does not yet support ≥ 6.1

## Alternatives considered and why not

TS 5.9 is incompatible with Nest 12; TS 7 (native) is not yet supported by `typescript-eslint` and some tooling
