# FlowSync — operations (production on a VPS)

The scripts live in `ops/`, work with Docker Compose and need nothing but bash and Docker.
**Production has not been deployed yet** (at the owner's instruction): everything below was verified locally, except the steps marked "VPS only".

## Health checks

| Endpoint | What it means | When it fails |
|---|---|---|
| `GET /api/health/live` | the process is alive and responding | only if the process itself hangs |
| `GET /api/health/ready` (and `GET /api/health`) | the API can serve traffic: the DB responds, Redis responds (only if `REDIS_URL` is set) | `503` when a dependency fails |

Why two: liveness deliberately does not touch the DB. Otherwise a Postgres outage would make the orchestrator restart a healthy API
endlessly. Readiness only takes the instance out of load balancing (Caddy checks it every 10 s).

## Backup and restore

```bash
./ops/backup.sh            # pg_dump → backups/flowsync-<UTC>.dump + .counts, files older than RETENTION_DAYS (14) are deleted
./ops/restore-verify.sh    # restores the newest dump into a temporary DB and compares row counts and migrations
```

- A file gets its final name only after `pg_restore --list` was able to read it: a truncated dump does not pass as a backup.
- `restore-verify.sh` is the proof that a backup is usable. Run it on a schedule, not just "sometime".
- Schedule (cron on the VPS): `0 3 * * * cd /opt/flowsync && ./ops/backup.sh >> backups/backup.log 2>&1`, a restore check once a week.
- Dumps sit on the same server: for real resilience they must be copied to other storage (VPS only; not configured).

## Deploy and rollback

1. CI is green → the `Deploy` workflow publishes the images `flowsync-back|front:<sha>`.
2. The owner manually runs the **Deploy to production** workflow (`workflow_dispatch`) with the `<sha>` tag.
3. On the VPS, `ops/deploy.sh <sha>` runs: a fresh backup → `docker compose up -d` → `ops/smoke-test.sh`.
4. If the smoke test fails, the previous tag is restored automatically (it is kept in `.deployed-tag`).

Important: rolling back an image does **not roll back DB migrations**. That is why migrations are written to be backward compatible
(first add, then remove in the next release), and a backup is taken before every deploy.

### One-time VPS setup (VPS only, not done yet)

1. Docker + Compose, clone the repository to `/opt/flowsync`, a DNS `A` record pointing at the server.
2. Root `.env`: `POSTGRES_PASSWORD`, `DOCKER_USERNAME`, `DOMAIN`, `ACME_EMAIL`; `backend/.env`: `JWT_SECRET` ≥ 32 characters, `COOKIE_SECURE=true`, `NODE_ENV=production`, `CORS_ORIGINS` set to your domain.
3. GitHub repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (a separate key for deploys only), `VPS_KNOWN_HOSTS` (the `ssh-keyscan` output).
4. A `production` environment in GitHub with a required reviewer (optional).
5. First run: `COMPOSE_FILES="-f docker-compose.yml -f docker-compose.vps.yml" ./ops/deploy.sh <sha>`.

## Smoke test

`./ops/smoke-test.sh <base-url>` checks: liveness, readiness, the home page, the SPA fallback on a deep link,
`401` on a protected API, `404` on Swagger, the CSP and `X-Content-Type-Options` headers. It exits non-zero on any failure.

## Observability

Three signals: **metrics** (what is happening overall), **traces** (what happened to one request), **logs** (details).
They are tied together by `requestId` and `trace_id`: pino adds `trace_id` to every log line, and `X-Request-Id` is returned to the client and in the error body.

```bash
# Dev: the backend sends traces, Prometheus collects metrics, Grafana shows them
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318 docker compose --profile observability up -d
```

| What | Where |
|---|---|
| The "FlowSync API" dashboard (RPS, 5xx, p50/p95/p99, slow routes, mail queue, sockets, event loop, memory) | http://localhost:3001 |
| Prometheus: targets and alerts | http://localhost:9090 |
| Jaeger: traces (HTTP → Prisma → Redis → BullMQ → Socket.IO in one trace) | http://localhost:16686 |
| Raw metrics | `GET /api/metrics` on the backend (:3000); nginx returns 404 there |

- **Metrics:** `prom-client`; the `route` label is the route template (`/api/projects/:id`), unknown URLs collapse to `unmatched`:
  otherwise every id or scanner would create a new time series. The mail queue and sockets are read at scrape time, with no background polling.
- **Traces:** OpenTelemetry (`src/config/instrument.ts`, the first import of `main.ts`); disabled while `OTEL_EXPORTER_OTLP_ENDPOINT` is empty.
  Prisma has its own instrumentation, BullMQ has `bullmq-otel`: a mail trace runs from the HTTP request to the worker.
- **Errors:** Sentry (`SENTRY_DSN` for the backend, `VITE_SENTRY_DSN` for the frontend at build time). Errors only: no tracing or session replay.
  The backend sends only `5xx`; the frontend sends route exceptions (not 404/403).
  **In production, add the DSN host to `connect-src` in `frontend/security-headers.conf`**, otherwise the CSP will block the reports.
- `METRICS_TOKEN` adds a bearer-token check on `/api/metrics` if Prometheus sits outside the Docker network.
- SLOs and alerts: `docs/SLO.md`.

## Event outbox

Every data change writes an event to the `outbox_events` table **in the same transaction** as the change. Right after the commit the event
is delivered to subscribers (audit, notifications, real-time); whatever fails is retried by `OutboxRelayService` (every 2 s).
Delivery is "at least once", so subscribers are idempotent (unique `eventId` in audit and notifications).

| Status | Meaning |
|---|---|
| `PENDING` | waiting for delivery; `attempts`, `last_error`, `next_attempt_at` show what went wrong and when the next attempt is (2, 4, 8 … 128 s) |
| `DONE` | delivered; records older than 7 days are deleted |
| `DEAD` | 8 failed attempts; **a human is needed** (the `OutboxEventDead` alert) |

```bash
# What is stuck and why
docker compose exec db psql -U postgres -d flowsync -c "SELECT id, type, attempts, last_error, next_attempt_at FROM outbox_events WHERE status <> 'DONE' ORDER BY created_at"

# After fixing the cause (for example, a subscriber was restored): give DEAD events another round of attempts
docker compose exec db psql -U postgres -d flowsync -c "UPDATE outbox_events SET status='PENDING', attempts=0, next_attempt_at=now() WHERE status='DEAD'"
```

It is safe to replay any event: subscribers will not create duplicates. Metrics: `flowsync_outbox_events{status}`,
`flowsync_outbox_oldest_pending_age_seconds`; alerts `OutboxEventDead`, `OutboxLagging`.

## Several API instances

With `REDIS_URL`, Socket.IO works through the Redis adapter: an update handled by one instance reaches browsers connected to
another. The outbox workers are also safe for several instances (`SKIP LOCKED`). Without Redis the API must run as **a single instance**:
otherwise some users will not receive live updates.

## Edit conflicts and cursors

- `PATCH /tasks/:id` requires `version`; if someone saved the task earlier, the response is `409` (the UI shows a message and reloads the task).
- Activity and comments are read by cursor (`?limit=&cursor=`); `nextCursor: null` means the last page.

## Security: scans and accounts

```bash
./ops/security-scan.sh images    # builds the production images and scans them with Trivy: fails on HIGH/CRITICAL that already have a fix
./ops/security-scan.sh secrets   # gitleaks over the whole git history (.gitleaks.toml: known false positives)
./ops/security-scan.sh sbom      # a CycloneDX bill of materials of the images in sbom/ (in CI it is a 90-day artifact)
```

In CI the same is done by the `security` job; `codeql.yml` (static analysis) runs on push, PR and weekly. Accepted exceptions are in
`.trivyignore` with a reason and a review date (currently empty). If you find a vulnerability in an image: update the package in `package.json`/Dockerfile,
do not add it to the ignore list without a reason.

**A user is locked out** (5 failed sign-ins): the lock clears itself after 15 min, or the user resets the password ("Forgot password?").
To lift it manually:

```bash
docker compose exec db psql -U postgres -d flowsync -c "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE email = 'user@example.com'"
```

**Verification and password-reset emails** are ordinary emails through the same queue (see "Outbox" and BullMQ above); in dev they are visible in Mailpit
(http://localhost:8025). Without a configured SMTP, emails are not sent, so password reset and verification are unavailable: SMTP is mandatory in production.

**Prisma 7 migrations:** `prisma migrate deploy` takes its settings from `prisma.config.ts` (copied into the production image). The image contains the Prisma CLI for
this command, which is why it is large (~1.1 GB); if that gets in the way, move migrations to a separate disposable image.
