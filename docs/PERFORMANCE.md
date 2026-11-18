# FlowSync — performance: measurements, findings, fixes

The target from `docs/SLO.md`: API response time p95 **< 300 ms**. This document shows how we measure it, what we found and what we fixed,
with "before" and "after" numbers. To rerun: `./ops/load/run.sh`.

## How we measure

| | |
|---|---|
| Tool | k6 (the `grafana/k6` container), the `ops/load/scenario.js` scenario |
| Target | the **production image** of the backend (`NODE_ENV=production`), a separate `flowsync_perf` DB in the dev Postgres; the rate limit is raised only for this instance (`RATE_LIMIT_PER_MINUTE`) |
| Data | `ops/load/seed.sql`: 50 users, 40 projects, **60,000 tasks**, **180,000 comments**, 100,000 activity records, tags and assignees |
| Load | 20 virtual users: 20 s ramp-up, 60 s hold, 10 s ramp-down |
| Request mix | 15% project list · 25% project tasks with a filter · 15% search · 15% task card · 10% comments · 8% activity · 7% new comment · 5% status change |
| Machine | Windows, Docker Desktop, 8 CPU, 8 GB; **everything on one machine** (backend, Postgres, k6, the rest of the dev stack) |

Absolute numbers depend on the machine, so we compare only runs on the same machine. The "before/after" difference below is the same
scenario with the same data. There is noise between runs (other containers, caches), so small differences (tens of percent) prove nothing,
while threefold ones do.

## Result

| Request | p95 before | p95 after | mean before | mean after |
|---|---:|---:|---:|---:|
| project list | 302 ms | **146 ms** | 121 ms | 67 ms |
| project tasks (filter, sorting) | 886 ms | **246 ms** | 406 ms | 107 ms |
| task search | 2,632 ms | 871 ms | 1,980 ms | 555 ms |
| task card | 587 ms | **201 ms** | 220 ms | 85 ms |
| comments (cursor) | 683 ms | **202 ms** | 254 ms | 91 ms |
| activity (cursor) | 521 ms | **184 ms** | 214 ms | 70 ms |
| new comment | 1,429 ms | 515 ms | 583 ms | 221 ms |
| status change | 913 ms | 400 ms | 404 ms | 197 ms |
| **everything together** | **2,121 ms** | **600 ms** | 533 ms | 169 ms |
| **throughput** | 31 requests/s | **98 requests/s** | | |

In bold are the requests that now fit within 300 ms. Search, comment creation and status change do not yet (see "What remains").

## Finding 1: the comment and task counter read the ENTIRE table (the main one)

**Symptom.** Even the simplest reads (a task card, the project list) had p95 of hundreds of milliseconds, and the DB CPU was busy.

**How it was found.** We enabled `log_statement = 'all'` for the test DB, looked at the SQL Prisma generates for the task list and ran
`EXPLAIN (ANALYZE, BUFFERS)`. Prisma translates `_count: { select: { comments: true } }` as

```sql
LEFT JOIN (SELECT task_id, COUNT(*) FROM comments GROUP BY task_id) a ON tasks.id = a.task_id
```

and for a list of 20 tasks the planner does:

```
->  HashAggregate (actual rows=60000)            -- grouping over ALL tasks
      ->  Seq Scan on comments c (actual rows=180198)   -- reads all 180,000 comments
Execution Time: 54.652 ms                        -- of which ~45 ms on this subquery
```

That is, the cost does not depend on the page size: 20 tasks or 1 — always a full scan. The same for `_count: { tasks }` in projects.
For a single task by id the planner "pushes down" the condition and all is well (0.125 ms), which is why the problem is invisible in tests on small data.

**Fix.** We compute the counts with a separate query only for the ids on the page (`groupBy` + `where taskId in (...)`), served by
the `comments(task_id, id)` index without reading the comments: 0.05 ms. One extra query per page instead of a full scan for each row.
Code: `TasksService.withCommentCounts`, `ProjectsService.taskCounts`.

**Effect.** Throughput ×3, p95 of "project tasks" 886 → 246 ms, of "project list" 302 → 146 ms. Even the requests this
did not touch (activity, comments) got 2.5–3 times faster, because the DB stopped scanning tables on every request.

## Finding 2: search did not use the task index

`EXPLAIN` showed `Seq Scan on tasks` (60,000 rows) and a repeated `to_tsvector` on every row, although the GIN index
`tasks_fts_idx` exists. The reason: the condition "a match in the task **OR** a comment with a match exists" — the planner cannot use the task index
for a branch with `OR EXISTS`.

**Fix.** Two separate branches via `UNION` (each has its own GIN index: `tasks_fts_idx`, `comments_fts_idx`), then ranking:

```
Was:  Seq Scan on tasks → Filter (OR EXISTS ...)      Execution Time: 743.6 ms
Now:  BitmapOr of two Bitmap Index Scans → HashAggregate  Execution Time: 179.9 ms   (4× faster, no schema change)
```

**A side correctness fix.** Previously, search took the 1000 best matches **from the entire DB** and checked project access afterwards.
In a large database, other people's tasks would crowd the visible ones out of the top 1000. Now `rankedIds` receives the list of accessible projects
(`ProjectsService.accessibleIds`, the same access rule as everywhere) and restricts the search to them.

## Finding 3: there is no N+1 (verified)

The number of SQL queries per HTTP request (the Postgres log, `log_statement = 'all'`):

| Request | SQL queries |
|---|---:|
| project list | 2 |
| project tasks (20, with assignees, tags, counters) | 2 |
| search | 3 |
| task card | 2 |
| comments | 2 |
| activity | 2 |
| new comment (transaction, outbox, audit, notifications) | 7 + 2 transactions |

The number does not grow with page size: assignees and tags are loaded with a single `IN (...)` for the whole page.

## What remains (honestly)

- **Search p95 871 ms** > 300 ms. The rest of the time is eaten by `ts_rank` ranking, which recomputes `to_tsvector` for ~18,000 matches. A candidate:
  a stored generated `tsvector` column + a GIN index on it (needs a migration with `Unsupported("tsvector")` and a schema drift check;
  the gain was **not measured**). The synthetic data here is harsher than real data: each of the 20 words occurs in ~10% of tasks.
- **Writes (new comment 515 ms, status 400 ms).** Each write is several separate commits: the change transaction with the event, the event claim,
  the audit write, the "delivered" mark. A candidate: merge delivery into one transaction or hand delivery to the relay. Not done:
  it changes the phase 12 guarantees.
- The run was on a laptop with the whole stack on one machine; on a separate server the numbers will differ. Measure on what will be in production.

## How to repeat

```bash
docker compose up -d                       # the dev stack: only its Postgres and network are needed
./ops/load/run.sh                          # image build, schema, data, k6, cleanup
VUS=50 ./ops/load/run.sh                   # more users
KEEP=1 ./ops/load/run.sh                   # keep the flowsync_perf DB for a manual EXPLAIN ANALYZE
```

The run summary is `.load-out/summary.json`. The p95 < 300 ms threshold in `scenario.js` is the SLO: a run that does not hold it exits with code 99.
