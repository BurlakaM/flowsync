# 45. Mutation tests and thresholds

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D45 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Stryker + the vitest runner for 7 key files (security, data, events), weekly in CI; coverage thresholds as "ratchets" slightly below the measured value; `@vitest/coverage-v8` in the frontend

## Alternatives considered and why not

Chasing 100% coverage (duplicates the implementation); mutating the whole backend (hours); coverage alone (does not distinguish "executed" from "verified")
