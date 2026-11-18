# 29. Events and permissions

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D29 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Services publish domain events (`@nestjs/event-emitter`); audit, notifications and real-time subscribe to them; permissions — `@casl/ability` in a single map, `app-ability.ts`

## Alternatives considered and why not

Calling subscribers directly from services (coupling); use-case classes (needless abstractions)

## Consequences

- The audit log, notifications and live updates are subscribers: a service does not know who is interested.
- Permissions are one map (`app-ability.ts`) that is easy to read and test.
- In-memory events were not durable: fixed by the outbox (ADR 37).

## When to revisit

If a subscriber lives in another service, publish the outbox to a broker instead of the internal emitter.
