# 33. i18n and the board

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D33 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`i18next` + `react-i18next`, text-as-key in code, a `uk.ts` dictionary with a completeness test; the kanban board on `@dnd-kit/core`

## Alternatives considered and why not

JSON files with semantic keys (easy to drift from the code); `react-beautiful-dnd` (unmaintained)
