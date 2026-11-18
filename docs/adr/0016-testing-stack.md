# 16. Tests

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D16 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Backend and frontend: Vitest (+ supertest, Testing Library, MSW); e2e: Playwright. The backend uses Vitest + SWC because Nest 12 packages became ESM (`import.meta`) and Jest cannot load them

## Alternatives considered and why not

Jest: incompatible with Nest 12

## Consequences

- Tests hit a real PostgreSQL (a separate disposable database): SQL, migrations and constraints are verified, not mocked.
- Unit tests mock Prisma (`vitest-mock-extended`); e2e tests use the real `AppModule`.
- Mutation tests (Stryker) and the coverage threshold check that tests would actually fail if the code were wrong (`docs/QUALITY.md`).

## When to revisit

When Nest gets convenient ESM support for Jest, nothing needs to change: Vitest remains faster.
