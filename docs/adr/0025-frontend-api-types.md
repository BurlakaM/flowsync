# 25. API types on the frontend

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D25 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`openapi-typescript` generates `src/types/api.generated.ts` from `backend/openapi.json`; `features/*/types` hold only aliases; CI checks that it is up to date. The package needs an `overrides` entry for its `typescript` peer (it declares `^5`, the project uses TS 6)

## Alternatives considered and why not

Hand-written types: drift from the API without warning
