# FlowSync — SLO

Reliability targets for the API. An SLO is a promise to yourself that can be measured and that drives decisions
("stop features and fix" or "there is headroom, we can take risks"). It is not a marketing number.

All indicators come from `/api/metrics` (see `docs/OPERATIONS.md`); the dashboard is Grafana "FlowSync API",
the alert rules are in `ops/observability/alerts.yml`.

## What counts as a "request"

All HTTP requests to the API except `/api/health/*` and `/api/metrics` (we do not measure them: they are not user work).
WebSocket connections are not part of the SLO: their state is visible in the `flowsync_websocket_connections` metric.

## Targets

| # | SLI (what we measure) | SLO | Window | Error budget |
|---|---|---|---|---|
| 1 | Availability: the share of requests without a `5xx` response | **99.5%** | 30 days | 0.5% of requests (≈ 3 h 36 min of total outage) |
| 2 | Speed: p95 of request duration | **< 300 ms** | 30 days, 5 min evaluation window | 5% of requests may be slower |
| 3 | Email: mail jobs stuck in `failed` | **0 for longer than 15 min** | current state | — |

Why these numbers:
- `4xx` is a client error (wrong password, someone else's resource), not a service failure, so it is excluded from availability.
- p95, not the average: the average hides the slow "tail" that real users see.
- 99.5% is realistic for a single VPS without redundancy; 99.9% would need a second instance and a fault-tolerant DB
  (that is phase 12), and a promise that cannot be kept is worse than a modest one.

## Alerts

| Alert | Condition | Severity | What to do |
|---|---|---|---|
| `ApiDown` | the target host does not answer a scrape for 1 min | page | `docker compose ps`, `logs backend`; check the DB and Redis (`/api/health/ready`) |
| `HighErrorRatio` | `5xx` > 2% of requests for 5 min | page | look at `Sentry`/logs by `requestId`, the trace in Jaeger; if after a deploy, roll back (`ops/deploy.sh` does it by itself only when the smoke test fails) |
| `SlowRequests` | p95 > 300 ms for 10 min | ticket | the "Slowest routes" dashboard, the trace of a slow request (`prisma:*` spans show the DB query) |
| `MailJobsFailing` | `flowsync_mail_queue_jobs{state="failed"}` > 0 for 15 min | ticket | SMTP availability; jobs retry by themselves (5 attempts, exponential delay) |
| `EventLoopLagging` | p99 of event loop lag > 200 ms for 5 min | ticket | a CPU-heavy operation in a request (hashing, large JSON); profile it |

The 2% threshold for `HighErrorRatio` is deliberately higher than the SLO (0.5%): the alert "wakes you up" only when the budget is burning
ten times faster than normal. Small deviations are visible on the dashboard but are not worth a night-time notification.

## Limitations (honestly)

- Alerts are currently visible only in the Prometheus UI (`:9090/alerts`). Delivery (Alertmanager, Telegram, email) is not configured:
  it makes sense to do that together with the production server (phase 10.5).
- The 30-day budget is calculated manually with a Grafana query; there is no separate "burn rate" dashboard.
- Metrics exist only from the moment the `observability` profile is enabled; Prometheus in dev does not keep data across container restarts.
