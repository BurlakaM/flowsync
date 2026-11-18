# 28. E2E and accessibility

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D28 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Playwright in `frontend/e2e` against a production-like stack (locally installed Chrome, Chromium in CI); `vitest-axe` in page tests

## Alternatives considered and why not

Cypress: heavier; a separate `e2e/` package: one more `package.json`
