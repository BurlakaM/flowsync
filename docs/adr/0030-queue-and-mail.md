# 30. Queue and mail

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D30 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

BullMQ + Redis (`bullmq`, `ioredis`) and `nodemailer`; without Redis, mail is sent inside the API process; without `SMTP_HOST` + `MAIL_FROM`, it is not sent at all and nothing fails; the transport can be replaced via a token (tests). No `@nestjs/bullmq`: we manage `Queue`/`Worker` ourselves so as not to connect to Redis when mail is disabled

## Alternatives considered and why not

`@nestjs/bullmq` (always connects to Redis); Kafka/RabbitMQ (overkill for a single service)

## Consequences

- An email never slows down a request and survives a restart when Redis is present.
- Redis is optional on purpose: the app works without it (without retries), which eases local development.

## When to revisit

If there are many emails, move the worker to a separate process (the queue code does not change).
