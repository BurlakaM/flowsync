# 7. Resource access

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D7 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Project membership is checked in services; for someone else's resource we return 404

## Alternatives considered and why not

CASL — only if the rules become numerous

## Consequences

- An outsider cannot learn that a resource exists: the response is `404`, not `403`.
- The rule lives in `ProjectsService` (see ADR 24), not in controllers.

## When to revisit

Fine-grained permissions from D29 moved to CASL; "who can see a project" remains a plain query.
