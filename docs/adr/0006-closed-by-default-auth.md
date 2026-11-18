# 6. Request authorization

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D6 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Passport JWT; a global "closed by default" guard + `@Public()`; roles via `@Roles()`

## Alternatives considered and why not

Per-route guards get forgotten (see B4)

## Consequences

- Forgetting to protect a route is impossible by construction: a new route is closed until someone writes `@Public()` and a comment.
- Every public route is a deliberate line visible in review (register, login, refresh, logout, password reset, email verification, health, metrics).
- Cost: a database user lookup on every request in `JwtStrategy` (one indexed query), so that deleting a user or changing a password takes effect immediately.

## When to revisit

If this lookup becomes a bottleneck, cache the user for a few seconds and accept a delay in revoking access.
