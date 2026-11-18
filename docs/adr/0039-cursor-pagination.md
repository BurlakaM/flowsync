# 39. Pagination of growing lists

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D39 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

A cursor (the id of the last row, `{ items, nextCursor }`, no `total`) for activity and comments; indexes `(project_id, id DESC)` and `(task_id, id)`. The remaining lists stay paged

## Alternatives considered and why not

Offset everywhere (repeats and gaps, slow on deep pages); a cursor by `createdAt` (needs a tiebreaker, a more complex index)

## Consequences

- Pages of the activity feed and comments neither repeat nor skip records while new ones arrive.
- No `COUNT(*)` for these lists: a deep page costs the same as the first.
- Other lists stay on pages with a total, because users jump by page number there.

## When to revisit

If a list needs "go to page N" or a total again, offset pagination is the right tool for it.
