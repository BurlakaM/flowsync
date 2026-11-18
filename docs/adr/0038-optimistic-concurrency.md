# 38. Concurrent editing

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D38 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Optimistic concurrency: `Task.version`, `PATCH` requires it, `update where { id, version }` + `increment`, a mismatch → 409

## Alternatives considered and why not

Pessimistic locks (hold a transaction while a person thinks); `updatedAt` as a token (collisions within a millisecond, still tied to the clock); `If-Match`/ETag (the same meaning, worse for JSON bodies and OpenAPI)

## Consequences

- Two people editing the same task never silently overwrite each other: the second gets a 409 and sees the newer version.
- The check and the write are a single SQL statement, so two parallel requests cannot both win (verified with four at once).
- The client must send `version` with every update: a deliberate breaking change.

## When to revisit

A merge UI (per field) would replace the simple "reload and retry".
