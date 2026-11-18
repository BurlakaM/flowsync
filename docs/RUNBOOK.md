# FlowSync — runbook: what to do when…

For the on-call person (currently the owner) who opens this file at three in the morning. Each section: **symptom → what to check → what to do → how to confirm**.
Commands are run from the repository root on the server (`/opt/flowsync`) or locally for dev. Do not run `DROP`/`DELETE` in the DB without a backup.

Useful links: state and metrics `docs/OPERATIONS.md`, SLOs and alerts `docs/SLO.md`, threat model `docs/THREAT_MODEL.md`, architecture `docs/ARCHITECTURE.md`.

## Quick diagnosis (always start here)

```bash
docker compose ps                                   # what is down or "unhealthy"
curl -s https://<domain>/api/health/ready           # 200 = DB and Redis respond, 503 = a dependency
docker compose logs --tail 100 backend              # the latest lines; each has requestId and trace_id
```

A single user request can be traced: `requestId` is in the error body and the `X-Request-Id` header, `trace_id` is in every log line
and in Jaeger.

## 1. The site does not open (5xx, timeout)

- **Check:** `docker compose ps`; `curl -I https://<domain>/`; `curl -s https://<domain>/api/health/live`.
- **Caddy/certificate:** `docker compose logs caddy`. An ACME error or "certificate expired" → does the DNS record point at the server? are ports 80/443 open?
- **nginx (frontend) unhealthy:** `docker compose logs frontend`, `docker compose restart frontend`.
- **backend does not start:** `docker compose logs backend`. Typical causes: an invalid environment variable (zod says which one), a `JWT_SECRET` shorter
  than 32 characters, a failed migration. The backend **deliberately** refuses to start with a bad config.
- **Confirm:** `./ops/smoke-test.sh https://<domain>` prints "Smoke test passed".

## 2. Everything is bad after a deploy

`ops/deploy.sh` rolls back by itself if the smoke test fails. If the rollback did not work or the problem shows up later:

```bash
cat .deployed-tag                                         # the last tag that passed the smoke test
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.vps.yml" ./ops/deploy.sh <previous-sha>
```

**Warning:** rolling back an image does **not undo migrations**. If a new migration was incompatible with the old code, restore the DB from a backup (section 8).

## 3. The DB is unavailable or /api/health/ready returns 503

- **Check:** `docker compose ps db`; `docker compose logs --tail 50 db`; disk space `df -h` (a full disk is the most common cause).
- **Not responding but the disk is free:** `docker compose restart db`, wait for the healthcheck. Data is in the `pg_data` volume, a restart does not touch it.
- **Forbidden without permission:** `docker compose down -v`, `docker volume rm`, `docker system prune` — they destroy data.
- **Confirm:** `/api/health/ready` → 200; in Grafana p95 and 5xx return to normal.

## 4. Redis is unavailable

Symptom: `/api/health/ready` returns 503 with `redis: down`; emails are not sent; live updates work only within one instance.

- `docker compose restart redis`. The mail queue lives in the `redis_data` volume (AOF), so queued emails survive a restart.
- Without Redis the app **keeps working** (emails are sent immediately, without retries), but `ready` shows 503: this is a signal to the operator.

## 5. Emails do not arrive (verification, password reset, notifications)

- **SMTP is not configured:** the backend log at startup says "Email is off (SMTP_HOST and MAIL_FROM are not set)". SMTP is mandatory in production (`SMTP_HOST`, `MAIL_FROM` in `backend/.env`).
- **The queue:** the metric `flowsync_mail_queue_jobs{state="failed"}` > 0 (the `MailJobsFailing` alert) — the mail server is refusing. Jobs retry by themselves
  (5 attempts, exponential delay); once SMTP recovers they will go through.
- **A "verification" email did not arrive:** the user can press "Send the link again" (no more than once a minute).
- **Dev:** all emails are visible in Mailpit, http://localhost:8025.

## 6. An event is stuck (the `OutboxEventDead` / `OutboxLagging` alert)

It means: the change was saved, but the audit entry, notification or live update for it was not delivered.

```bash
docker compose exec db psql -U postgres -d flowsync -c \
  "SELECT id, type, attempts, last_error, next_attempt_at FROM outbox_events WHERE status <> 'DONE' ORDER BY created_at"
```

- `last_error` says what exactly is failing. Fix the cause (for example, a subscriber bug) and deploy the fix.
- Give `DEAD` events another round of attempts (safe: subscribers are idempotent):

```bash
docker compose exec db psql -U postgres -d flowsync -c \
  "UPDATE outbox_events SET status='PENDING', attempts=0, next_attempt_at=now() WHERE status='DEAD'"
```

- `OutboxLagging` without `DEAD`: the relay is not running or the DB is overloaded — `docker compose logs backend | grep -i outbox`.

## 7. Slow or many errors (the `SlowRequests`, `HighErrorRatio` alerts)

1. Grafana "FlowSync API": which route (the "Slowest routes" panel), since when.
2. Jaeger: find a slow trace of that route; long `prisma:client:db_query` spans mean the problem is in SQL.
3. Check the DB load (`docker stats`, `pg_stat_activity`). A typical cause is a query without an index or a `COUNT` over a large table
   (see `docs/PERFORMANCE.md`: that is how a full count scan was found).
4. If it started after a deploy — roll back (section 2).
5. Measure on a copy with data: `./ops/load/run.sh`.

## 8. Restoring from a backup

```bash
ls -lt backups/ | head                                  # available dumps
./ops/restore-verify.sh backups/flowsync-<time>.dump    # FIRST check that the dump restores (a temporary DB, does not touch prod)
```

Restoring into production **destroys the current data**, so this is a deliberate action by the owner: stop the backend, create an empty DB, `pg_restore` into it,
switch `POSTGRES_DB` or rename the DB, start the backend. Before any restore, take one more backup of the current state.
A backup is taken before every deploy (`ops/deploy.sh`) and on a cron schedule (an example is in `docs/OPERATIONS.md`; it still has to be set up on the VPS); dumps are kept for 14 days.

## 9. A user cannot sign in

| Symptom | Cause and action |
|---|---|
| "Too many failed sign-in attempts" (429) | the account is locked for 15 min after 5 failures; it expires by itself, or the user resets the password ("Forgot password?"). To lift it manually: `UPDATE users SET locked_until=NULL, failed_login_attempts=0 WHERE email='…'` |
| "Invalid email or password" | an ordinary wrong password; check the email for typos |
| The reset email does not arrive | section 5; note that the form responds the same for any address (deliberate, so as not to reveal accounts) |
| After a password change all devices were "kicked out" | by design: a password change ends all sessions |

## 10. Suspected compromise

- **A secret leaked (`JWT_SECRET`, SMTP, S3, DB):** change the value in `.env`, restart (`docker compose up -d`). Changing `JWT_SECRET` ends all sessions.
- **A suspicious sign-in:** `docker compose logs backend | grep -i "locked\|failed"`; have the user reset the password (this revokes all their sessions).
- **A leak in git:** `./ops/security-scan.sh secrets`; treat the leak as final — change the secret, do not merely delete the file from history.

## After every incident

Record it in `docs/ARCHITECTURE_PLAN.md` (the log) or a separate post-mortem: what happened, how it was noticed, how it was fixed, what to do so it does not recur
(an alert, a test, a check). An incident without conclusions will happen again.
