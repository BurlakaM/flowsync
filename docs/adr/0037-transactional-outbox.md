# 37. Event delivery

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D37 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Transactional outbox (`outbox_events`): the event is written in the change's transaction (`DomainEventsService.transact`), delivered immediately after commit, and `OutboxRelayService` picks up anything undelivered (claim `UPDATE … FOR UPDATE SKIP LOCKED` with a 30 s lease, 2^n s backoff, `DEAD` after 8 attempts). At-least-once delivery; subscribers are idempotent (`eventId`)

## Alternatives considered and why not

In-memory events (lost if the process dies between the write and the publish); BullMQ/Kafka as the transport (Redis is optional, extra infrastructure); CDC/Debezium (a separate service); exactly-once (unachievable without idempotency anyway)

## Consequences

- The change and the event are stored atomically: there is no "saved, but nobody found out" state.
- Delivery is at-least-once, so subscribers are idempotent (a unique `eventId` in audit and notifications) and do not swallow errors.
- A dead event (8 failed attempts) raises an alert instead of disappearing.
- The relay and the claim are safe for several API instances (`FOR UPDATE SKIP LOCKED` and a lease).
- Cost: several small commits per request (the change, the claim, subscriber writes, "delivered"): see "What remains" in `docs/PERFORMANCE.md`.

## When to revisit

If the write path becomes a bottleneck, hand delivery to the relay in batches instead of a claim per request.
