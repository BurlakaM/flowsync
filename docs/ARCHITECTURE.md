# FlowSync — architecture (C4)

Diagrams following the C4 model: from the big picture (who uses the system) to the components inside the backend. GitHub renders Mermaid
blocks right in Markdown. Decision details are in `docs/adr/`, processes and incidents in `docs/RUNBOOK.md`, performance numbers in `docs/PERFORMANCE.md`.

## 1. Context: who and why

```mermaid
flowchart LR
    user(["User<br/>manages projects and tasks in a browser"])
    admin(["Owner / operator<br/>deploy, backups, monitoring"])

    subgraph flowsync["FlowSync"]
        system["Task tracker<br/>projects, tasks, comments, tags,<br/>notifications, live updates"]
    end

    mail[("SMTP mail server<br/>emails: verification, password reset,<br/>notifications")]
    s3[("S3 storage<br/>project images")]
    sentry[("Sentry (optional)<br/>error reports")]

    user -->|"HTTPS: pages, API, WebSocket"| system
    admin -->|"SSH, GitHub Actions, Grafana"| system
    system -->|"SMTP"| mail
    system -->|"S3 API"| s3
    system -.->|"HTTPS, errors only"| sentry
    mail -.->|"link from the email"| user
```

Email is a separate trust channel: password reset and address verification rely on it (see `docs/THREAT_MODEL.md`).

## 2. Containers: what the system consists of

```mermaid
flowchart TB
    browser(["Browser<br/>React 19 SPA"])

    subgraph host["Server (Docker Compose)"]
        caddy["Caddy<br/>TLS, HTTP/3<br/>(VPS only)"]
        nginx["frontend: nginx<br/>SPA static files, CSP,<br/>proxy /api and /api/socket.io"]
        api["backend: NestJS 12<br/>REST + Socket.IO,<br/>outbox and mail queue worker"]
        db[("PostgreSQL 16<br/>data, outbox, full-text search")]
        redis[("Redis 7<br/>BullMQ mail queue,<br/>Socket.IO bus")]
    end

    mail[("SMTP")]
    s3[("S3 storage")]

    subgraph obs["Observability (the observability profile)"]
        prom["Prometheus"]
        graf["Grafana"]
        jaeger["Jaeger"]
    end

    browser -->|"HTTPS"| caddy --> nginx
    nginx -->|"/api"| api
    api -->|"Prisma 7 + pg"| db
    api --> redis
    api -->|"emails"| mail
    api -->|"images"| s3
    prom -->|"scrape /api/metrics<br/>(inside the network only)"| api
    api -.->|"OTLP: traces"| jaeger
    graf --> prom
    graf --> jaeger
```

| Container | Responsibility | What it does **not** do |
|---|---|---|
| nginx | serves the SPA, sets security headers (CSP), proxies `/api` | does not expose `/api/metrics` to the outside (404) |
| backend | all business logic, authorization, permissions, events, emails | does not keep session state in memory (tokens are in the DB) |
| PostgreSQL | the single source of truth; the outbox lives in the same DB | is not published to the outside |
| Redis | optional: the mail queue and the bus between API instances | without it everything works, but on one instance and without email retries |

## 3. Backend components

```mermaid
flowchart TB
    http(["HTTP / WebSocket"])

    subgraph api["backend (NestJS)"]
        direction TB
        guards["Global guards<br/>rate limit → JWT → roles"]
        ctrl["Controllers<br/>auth, users, projects, tasks,<br/>comments, tags, activity, notifications"]

        subgraph services["Services (business logic)"]
            direction LR
            projects["ProjectsService<br/>the access rule (accessFilter)"]
            tasks["TasksService<br/>task versions, search"]
            comments["CommentsService"]
            authsvc["AuthService<br/>lockout, password reset"]
        end

        events["DomainEventsService<br/>transact() + outbox"]
        relay["OutboxRelayService<br/>claim SKIP LOCKED, backoff"]

        subgraph subs["Event subscribers"]
            direction LR
            audit["Audit log"]
            notif["Notifications + emails"]
            rt["Real-time (Socket.IO)"]
        end

        casl["CASL: the permission map"]
        prisma["PrismaService (pg)"]
    end

    pg[("PostgreSQL")]

    http --> guards --> ctrl --> services
    services --> casl
    services --> events
    services --> prisma
    events -->|"event written in the same transaction"| prisma
    events -->|"delivery right after commit"| subs
    relay -->|"whatever failed"| subs
    relay --> prisma
    subs --> prisma
    prisma --> pg
```

Key rules (details in `backend/AGENTS.md` and `docs/adr/`):

- A controller is thin; a service checks access first and returns via `select`, never a whole entity.
- All data changes publish events **in the same transaction** (ADR 37); subscribers are idempotent.
- Modules talk only through exported services; "who can see a project" is decided only by `ProjectsService` (ADR 24).

## 4. The dynamic picture: a new comment from request to screen

```mermaid
sequenceDiagram
    autonumber
    actor A as Hanna (browser A)
    actor B as Bohdan (browser B)
    participant API as backend
    participant DB as PostgreSQL
    participant Mail as Mail queue → SMTP

    A->>API: POST /api/tasks/9/comments
    API->>DB: check access to the task (404 for outsiders)
    API->>DB: BEGIN: INSERT comment + INSERT outbox_event: COMMIT
    API-->>A: 201 Created
    Note over API,DB: the response has already been sent,<br/>event delivery continues
    API->>DB: claim the event (UPDATE … FOR UPDATE SKIP LOCKED)
    par subscribers (at least once)
        API->>DB: audit: INSERT audit_log (unique eventId)
    and
        API->>DB: notifications (unique eventId + userId)
        API->>Mail: email only to a verified address
    and
        API-->>B: Socket.IO: "something changed in the project"
    end
    API->>DB: outbox_event → DONE
    B->>API: GET /api/tasks/9/comments (cache refresh)
    Note over API,DB: if the process died after the commit, the relay<br/>picks the event up in ~30 s (lease)
```

## 5. Deployment

```mermaid
flowchart LR
    dev["Developer<br/>docker compose up<br/>(dev: hot reload, Mailpit, RustFS)"]
    gh["GitHub Actions<br/>lint, types, tests, e2e, Trivy,<br/>gitleaks, CodeQL, Lighthouse"]
    reg[("Image registry<br/>flowsync-back / -front:&lt;sha&gt;")]
    vps["VPS: docker-compose.vps.yml<br/>ops/deploy.sh: backup → up → smoke test → rollback"]

    dev -->|"git push"| gh -->|"main is green: images"| reg
    reg -->|"manual workflow<br/>Deploy to production"| vps
```

The VPS deploy has not been performed yet (at the owner's instruction); everything leading up to it is ready and verified locally (`docs/OPERATIONS.md`).
