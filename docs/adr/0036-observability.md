# 36. Спостережуваність

- **Статус:** прийнято
- **Дата:** 2026-11-17
- **У журналі плану:** D36 (`docs/ARCHITECTURE_PLAN.md`, розділ 3)

## Рішення

Метрики — `prom-client` (приватний реєстр, `/api/metrics` закритий nginx-ом і за бажанням `METRICS_TOKEN`); трейси — OpenTelemetry SDK з OTLP/HTTP і окремими інструментаторами (http, express, ioredis, socket.io, pino, Prisma, `bullmq-otel`), увімкнені лише з `OTEL_EXPORTER_OTLP_ENDPOINT`; помилки — Sentry (`@sentry/nestjs`, `@sentry/react`) лише як лічильник помилок, без трасування й запису сесій; dev-стек Prometheus + Grafana + Jaeger у профілі `observability`

## Що розглядали й чому ні

`nestjs-otel`/`@willsoto/nestjs-prometheus` (обгортки без виграшу); `auto-instrumentations-node` (десятки зайвих інструментаторів і залежностей); Sentry tracing (два провайдери трасування); Loki/Tempo (більше сервісів, ніж потрібно одному VPS)

## Наслідки

- Метрики, трейси й звіти про помилки суто опційні: без endpoint-а чи DSN відповідний код не працює.
- Один trace проходить HTTP, Prisma, Redis, BullMQ і Socket.IO; логи мають `trace_id`.
- Sentry лише рахує помилки, тож не конкурує з OpenTelemetry за трасувальник.

## Коли переглянути

Якщо логи треба шукати централізовано, додати Loki (поля `requestId`/`trace_id` уже є в кожному рядку).
