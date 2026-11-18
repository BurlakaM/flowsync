# 24. Access rights

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D24 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

A single source of truth for "who can see a project" — `ProjectsService` (owner or member); an outsider → 404, a member without the right → 403; ADMIN does not bypass project access

## Alternatives considered and why not

A global bypass for ADMIN: widens the attack surface; CASL: overkill, few rules so far

## Consequences

- One rule in one place (`accessFilter`) is used by tasks, comments, search (`accessibleIds`) and notifications.
- ADMIN has no "back door" into other people's projects: a smaller attack surface, at the cost that support cannot see data without database access.

## When to revisit

If support needs to see customers' projects, add a logged "sign in as" mode rather than a silent bypass.
