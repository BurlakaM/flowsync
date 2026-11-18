# 36. Observability

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D36 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Metrics — `prom-client` (a private registry, `/api/metrics` closed by nginx and optionally by `METRICS_TOKEN`); traces — the OpenTelemetry SDK with OTLP/HTTP and individual instrumentations (http, express, ioredis, socket.io, pino, Prisma, `bullmq-otel`), enabled only with `OTEL_EXPORTER_OTLP_ENDPOINT`; errors — Sentry (`@sentry/nestjs`, `@sentry/react`) only as an error counter, without tracing or session replay; a dev Prometheus + Grafana + Jaeger stack in the `observability` profile

## Alternatives considered and why not

`nestjs-otel`/`@willsoto/nestjs-prometheus` (wrappers with no gain); `auto-instrumentations-node` (dozens of unneeded instrumentations and dependencies); Sentry tracing (two tracing providers); Loki/Tempo (more services than one VPS needs)

## Consequences

- Metrics, traces and error reports are purely optional: without an endpoint or DSN the corresponding code does not run.
- A single trace spans HTTP, Prisma, Redis, BullMQ and Socket.IO; logs carry `trace_id`.
- Sentry only counts errors, so it does not compete with OpenTelemetry for the tracer.

## When to revisit

If logs need centralized search, add Loki (the `requestId`/`trace_id` fields are already in every line).
