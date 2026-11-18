# FlowSync — architecture migration plan

> A living document. Created on 2026-11-16 from an analysis of open-source NestJS and React projects
> (Docmost, Novu, AFFiNE, Teable, Immich, Postiz, Twenty, Vendure, brocoders/nestjs-boilerplate, bulletproof-react).
> Completed items are marked `[x]`, and a summary of each step is added to the "Progress log" at the bottom.
> Code-writing rules are in `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`.

## 1. Goal and principles

**Goal:** turn the pet project into a maintainable application with a modern architecture, a secure API and
a typed frontend, without losing a working state at any step.

Principles:

1. **Security first, beauty second.** Critical holes are closed before any refactoring (phase 0).
2. **Small steps.** One phase — one branch `refactor/phase-N-<name>`; after every item the project builds and runs.
3. **Do not overcomplicate.** We take practices from large projects, but only those that pay off at our scale
   (no CQRS, hexagonal, GraphQL, Nx).
4. **Automatic checks.** Whatever a machine can verify (lint, types, tests, CI) is not verified by eye.
5. **Decisions are recorded.** Every choice of a library or approach is fixed in section 3.

## 2. Current state (baseline on 2026-11-16)

What is already good: a Nest module structure by feature, Prisma + PostgreSQL 16, DTOs with `class-validator`, a Docker stack
(backend + frontend + db with a healthcheck) that works, CI with image builds, role seeding.

Problems (which the plan fixes):

| # | Problem | Where | Phase |
|---|---|---|---|
| B1 | `GET /api/users/:email` without authorization returns the user record together with the password hash | `backend/src/users/users.controller.ts:15` | 0 |
| B2 | `POST /api/users` returns the password hash in the response | `backend/src/users/users.service.ts:14` | 0 |
| B3 | The client chooses `role_id` at registration (one can register as an admin) | `user.dto.ts`, `users.service.ts:13` | 0 |
| B4 | `POST /tasks` and `POST /comments` without `JwtAuthGuard`; `user_id` is taken from the request body | `tasks.controller.ts:16`, `comments.controller.ts:10` | 0 |
| B5 | Task creation does not check access to `project_id` (one can write to someone else's project) | `tasks.service.ts:17` | 0 |
| B6 | No global `ValidationPipe`: `POST /users`, `POST /auth/login` are not validated; `main.ts` has `enableCors()` for all origins | `main.ts` | 0 |
| B7 | Two competing JWT mechanisms: a custom `canActivate` puts the payload (`sub`) in `request.user`, while `JwtStrategy.validate` returns `{userId, username}` and is never used | `conception/jwt.auth.guard.ts`, `auth/jwt.strategy.ts` | 0 |
| B8 | No env validation; `SECRET_KEY` may be `undefined`; DB passwords are hardcoded in compose | `app.module.ts`, `docker-compose.yml` | 1–2 ✓ |
| B9 | `prisma db push` on container start instead of migrations | `docker-compose.yml` | 3 ✓ |
| B10 | DB schema: a `creared_at` typo, `snake_case` models, a duplicated task↔tag link (`tags` and `task_tags`), no `updatedAt`, no indexes on FKs, mandatory `description`/`image` | `schema.prisma` | 3 ✓ |
| B11 | `strictNullChecks` and `noImplicitAny` are off, `any` in services | `tsconfig.json` | 2 ✓ |
| B12 | Nest 10 (the current branch is already 12); Node 20 reached end-of-life in April 2026 | `package.json`, Dockerfile | 1–2 ✓ |
| B13 | Two lock files in the backend (`yarn.lock` and `package-lock.json`) | `backend/` | 1 |
| F1 | The frontend is on Create React App (a discontinued project) and plain JS; fetch logic directly in components | `frontend/src/**` | 5 |
| F2 | Unneeded dependencies: `jquery`, `react-bootstrap` + `react-bootstrap-v5`, `react-helmet` | `frontend/package.json` | 5 |
| F3 | `ProtectedRoute` called `POST /auth/validate-token` on every entry (closed in phase 6: `GET /auth/me`); the token is in `localStorage` (closed in phase 7: token in memory + a refresh cookie) | `ProtectedRoute.js` | 6–7 |
| F4 | `Dashboard` is a stub, there is no task/project functionality in the UI | `cabinet/Dashboard.js` | 6 |
| I1 | nginx without an SPA fallback: refreshing the `/dashboard` page in the container gives 404; the API URL is baked in at build time from `frontend/.env` | `frontend/Dockerfile` | 1 |
| I2 | The README describes Vite, `back/front` folders and a `docker-compose.override.yml` that do not exist | `README.md` | 1 |
| I3 | CI pushes images on every push to `main` without lint/tests; `actions/checkout@v3` | `.github/workflows/ci-cd.yml` | 1 |
| I4 | The package names are `jira` (backend) and `my-app` (frontend), the DB is called `jira` | `package.json`, compose | 1 |

## 3. Decision log

Status `accepted` = the default used by AI agents. A decision can be changed by updating its row here
and the corresponding rules in `AGENTS.md`. Expanded versions are in `docs/adr/`.

| # | Topic | Decision | Alternatives and why not |
|---|---|---|---|
| D1 | Backend layers | Controller → Service → Prisma. A separate `*.repository.ts` only when a query is complex or reused | Hexagonal (brocoders), use-case classes (Novu): too many files for CRUD |
| D2 | Database and migrations | PostgreSQL 16 + Prisma, migrations via `prisma migrate` | `db push` only for quick experiments |
| D3 | Roles | `enum Role { USER ADMIN }` on the `User` model instead of a `role` table | A roles table is only justified with dynamic permissions; role seeding then becomes unnecessary |
| D4 | API style | REST + OpenAPI (Swagger), camelCase in JSON | GraphQL: a single web client, simple entities |
| D5 | Validation | `class-validator` in DTOs + a global `ValidationPipe`; env via `zod` | `nestjs-zod`: needless DTO migration |
| D6 | Request authorization | Passport JWT; a global "closed by default" guard + `@Public()`; roles via `@Roles()` | Per-route guards get forgotten (see B4) |
| D7 | Resource access | Project membership is checked in services; for someone else's resource we return 404 | CASL — only if the rules become numerous |
| D8 | Frontend build | Vite + React 19 + TypeScript (strict) | CRA is discontinued; Next.js is not needed for a dashboard behind a login |
| D9 | Routing | `react-router` v8 (library mode, lazy routes; `RouterProvider` from `react-router/dom`) | TanStack Router: also good, but fewer examples in the projects from this survey |
| D10 | State | Server state — TanStack Query v5; client state — `useState`/Context, `zustand` only for truly global state | Redux/Recoil: overkill |
| D11 | UI | Tailwind CSS 4 + shadcn/ui (Radix) | Mantine (as in Docmost): faster start, but less control; Bootstrap is being removed |
| D12 | Forms | `react-hook-form` + `zod` | Formik: outdated |
| D13 | Frontend structure | Feature folders following bulletproof-react; imports between features are forbidden (ESLint) | The flat CRA structure |
| D14 | Front↔back contract | OpenAPI → a generated TS client (`openapi-typescript`), phase 7 | A shared types package: requires monorepo tooling |
| D15 | Repository | Two independent packages, `npm` only, no Nx/Turborepo | Monorepo tooling pays off with 3+ packages |
| D16 | Tests | Backend and frontend: Vitest (+ supertest, Testing Library, MSW); e2e: Playwright. The backend uses Vitest + SWC because Nest 12 packages became ESM (`import.meta`) and Jest cannot load them | Jest: incompatible with Nest 12 |
| D17 | CI | PR checks (lint, types, tests, build) → deploy only from `main` after success; image tags `:<sha>` and `:latest` | — |
| D18 | Compose | `docker-compose.yml` (prod) + `docker-compose.override.yml` (dev, hot reload); secrets in `.env`, not in the repository | — |
| D19 | Runtime | Node 24 LTS (or 22 if a dependency does not support 24) | Node 20 is EOL. Node 26 is already LTS (since November 2026), but CRA is not verified on it (the backend is already on Nest 12 / Prisma 6.19): return to it after phase 5 |
| D20 | TypeScript | `~6.0` with `strict: true`: `@nestjs/schematics@12` requires ≥ 6, and `typescript-eslint` does not yet support ≥ 6.1 | TS 5.9 is incompatible with Nest 12; TS 7 (native) is not yet supported by `typescript-eslint` and some tooling |
| D21 | Logging and API protection | `nestjs-pino` (JSON in production, pretty in dev, tokens redacted), `helmet`, `@nestjs/throttler` (100/min globally, 5/min for login and registration), `TRUST_PROXY` behind nginx | A custom logger/middleware: duplicates what already exists |
| D22 | Access model | The project owner is `Project.ownerId`; additional participants are `ProjectMember`; access is checked in services. User roles are `enum Role` | The owner also in `ProjectMember`: duplicates data |
| D23 | Migrations | `prisma migrate` (SQL in the repository), `migrate deploy` on start in Docker; CI checks for drift between schema and migrations | `db push`: leaves no history and is dangerous for data |
| D24 | Access rights | A single source of truth for "who can see a project" — `ProjectsService` (owner or member); an outsider → 404, a member without the right → 403; ADMIN does not bypass project access | A global bypass for ADMIN: widens the attack surface; CASL: overkill, few rules so far |
| D25 | API types on the frontend | `openapi-typescript` generates `src/types/api.generated.ts` from `backend/openapi.json`; `features/*/types` hold only aliases; CI checks that it is up to date. The package needs an `overrides` entry for its `typescript` peer (it declares `^5`, the project uses TS 6) | Hand-written types: drift from the API without warning |
| D26 | Session | A 15-minute access JWT in memory + a refresh token in an `httpOnly` cookie (`SameSite=Strict`, `Path=/api/auth`), rotation, family revocation on reuse, only a SHA-256 hash in the DB; `COOKIE_SECURE` for HTTPS | JWT in `localStorage` (XSS steals the token); a long-lived access token |
| D27 | Request id | `X-Request-Id` via `genReqId` in `nestjs-pino` (the incoming header if it looks like an id, otherwise a UUID) and a `requestId` field in the error body | `nestjs-cls`: a separate dependency with no benefit while the id is only needed by logs and the response |
| D28 | E2E and accessibility | Playwright in `frontend/e2e` against a production-like stack (locally installed Chrome, Chromium in CI); `vitest-axe` in page tests | Cypress: heavier; a separate `e2e/` package: one more `package.json` |
| D29 | Events and permissions | Services publish domain events (`@nestjs/event-emitter`); audit, notifications and real-time subscribe to them; permissions — `@casl/ability` in a single map, `app-ability.ts` | Calling subscribers directly from services (coupling); use-case classes (needless abstractions) |
| D30 | Queue and mail | BullMQ + Redis (`bullmq`, `ioredis`) and `nodemailer`; without Redis, mail is sent inside the API process; without `SMTP_HOST` + `MAIL_FROM`, it is not sent at all and nothing fails; the transport can be replaced via a token (tests). No `@nestjs/bullmq`: we manage `Queue`/`Worker` ourselves so as not to connect to Redis when mail is disabled | `@nestjs/bullmq` (always connects to Redis); Kafka/RabbitMQ (overkill for a single service) |
| D31 | Files | Uploads through the API (`multer`): type detected from the bytes, up to 2 MB, SVG forbidden; stored in S3-compatible storage (`@aws-sdk/client-s3`), served only to project members. Dev storage is RustFS (the MinIO image is no longer published for free) | Presigned URLs: the storage must be reachable from the browser, and the server does not verify the file type |
| D32 | Real-time | `@nestjs/websockets` + `socket.io` under `/api/socket.io` (the same proxy as the API); authorization by a token in the handshake, rooms by access; events only announce a change, the client fetches data through the API | SSE (one-directional, but a separate route); sending full data in events (leakage, duplicated permissions) |
| D33 | i18n and the board | `i18next` + `react-i18next`, text-as-key in code, a `uk.ts` dictionary with a completeness test; the kanban board on `@dnd-kit/core` | JSON files with semantic keys (easy to drift from the code); `react-beautiful-dnd` (unmaintained) |
| D34 | Design system | "Aurora": oklch tokens in `index.css`, light ("paper", indigo → teal) and dark themes with a switcher (`.dark` class, choice stored in `localStorage`, an early script from `public/` because the CSP forbids inline scripts); fonts Inter (text) + Manrope Variable (headings, `@fontsource-variable/manrope`, includes Cyrillic); statuses have their own colors and icons; the color of a project, person or tag is derived from its name (no new DB fields); the existing logo stays | Midnight (dark-first) and Paper (serif) — not chosen by the owner; a new logo — the owner declined |
| D35 | Production operations | Scripts in `ops/` in plain bash + Docker Compose; `docker-compose.vps.yml` (images from a registry + Caddy); `pg_dump` backup with a row-count file and `restore-verify.sh`; manual deploy (`workflow_dispatch`) with automatic rollback on a smoke test; liveness does not touch dependencies, readiness checks the DB and Redis (if configured) | Kubernetes/Ansible/Terraform (overkill for one VPS); `pgBackRest`/WAL archiving (PITR is needed when the data matters, not in a pet project); auto-deploy on every push (the owner wants to control the moment) |
| D36 | Observability | Metrics — `prom-client` (a private registry, `/api/metrics` closed by nginx and optionally by `METRICS_TOKEN`); traces — the OpenTelemetry SDK with OTLP/HTTP and individual instrumentations (http, express, ioredis, socket.io, pino, Prisma, `bullmq-otel`), enabled only with `OTEL_EXPORTER_OTLP_ENDPOINT`; errors — Sentry (`@sentry/nestjs`, `@sentry/react`) only as an error counter, without tracing or session replay; a dev Prometheus + Grafana + Jaeger stack in the `observability` profile | `nestjs-otel`/`@willsoto/nestjs-prometheus` (wrappers with no gain); `auto-instrumentations-node` (dozens of unneeded instrumentations and dependencies); Sentry tracing (two tracing providers); Loki/Tempo (more services than one VPS needs) |
| D37 | Event delivery | Transactional outbox (`outbox_events`): the event is written in the change's transaction (`DomainEventsService.transact`), delivered immediately after commit, and `OutboxRelayService` picks up anything undelivered (claim `UPDATE … FOR UPDATE SKIP LOCKED` with a 30 s lease, 2^n s backoff, `DEAD` after 8 attempts). At-least-once delivery; subscribers are idempotent (`eventId`) | In-memory events (lost if the process dies between the write and the publish); BullMQ/Kafka as the transport (Redis is optional, extra infrastructure); CDC/Debezium (a separate service); exactly-once (unachievable without idempotency anyway) |
| D38 | Concurrent editing | Optimistic concurrency: `Task.version`, `PATCH` requires it, `update where { id, version }` + `increment`, a mismatch → 409 | Pessimistic locks (hold a transaction while a person thinks); `updatedAt` as a token (collisions within a millisecond, still tied to the clock); `If-Match`/ETag (the same meaning, worse for JSON bodies and OpenAPI) |
| D39 | Pagination of growing lists | A cursor (the id of the last row, `{ items, nextCursor }`, no `total`) for activity and comments; indexes `(project_id, id DESC)` and `(task_id, id)`. The remaining lists stay paged | Offset everywhere (repeats and gaps, slow on deep pages); a cursor by `createdAt` (needs a tiebreaker, a more complex index) |
| D40 | Real-time across several instances | `@socket.io/redis-adapter` only with `REDIS_URL`, wired in `main.ts`; without Redis — a single instance | Sticky sessions without an adapter (events are still lost between instances); a custom bus |
| D41 | Account and sessions | Password reset and email verification are one-time tokens from an email (`user_tokens`, SHA-256, 1 h / 24 h, single use), placed in the link's `#fragment`; responses do not reveal whether an account exists; lockout after 5 failures for 15 min (`429`); a password change/reset in one transaction invalidates refresh tokens and previously issued access tokens (`passwordChangedAt`); notification emails go only to verified addresses; existing accounts are considered verified | A token in the query string (ends up in logs and `Referer`); automatic verification when the link is opened (mail scanners "burn" it); lockout by IP only (bypassed by rotating addresses); lockout without a reset (a user with no way out) |
| D42 | Security scans | The `ops/security-scan.sh` script in Docker (Trivy for images, gitleaks for history, a CycloneDX SBOM) — the same locally and in CI; CodeQL as a separate workflow; `npm audit` remains for dependencies | `npm audit` alone (does not see the OS, the npm from the base image, or nginx); paid/cloud scanners (need accounts) |
| D43 | Prisma 7 | Prisma 7.10 (stable; `latest` on npm points to 8.0 RC), the client through the `pg` driver (`@prisma/adapter-pg`), `prisma.config.ts` instead of `package.json#prisma` and `url` in the schema, the `prisma-client-js` generator is kept | Stay on 6.x (an unfixed `deepmerge-ts` vulnerability in the CLI); Prisma 8 RC (not yet stable); the new `prisma-client` generator (changes all imports, no gain here) |
| D44 | Git hooks | Husky + lint-staged: the root `package.json` exists **only** for the hooks (`prepare: husky`); the lint-staged config lives in each package, so ESLint and Prettier use their own settings; `commit-msg` checks Conventional Commits, `pre-push` checks types | Native git hooks in `.githooks` (no dependencies, but they are not installed automatically after `git clone`); `simple-git-hooks`; a monorepo tool (D15) |
| D45 | Mutation tests and thresholds | Stryker + the vitest runner for 7 key files (security, data, events), weekly in CI; coverage thresholds as "ratchets" slightly below the measured value; `@vitest/coverage-v8` in the frontend | Chasing 100% coverage (duplicates the implementation); mutating the whole backend (hours); coverage alone (does not distinguish "executed" from "verified") |
| D46 | Performance measurement | k6 in a container against the production image and a separate DB with 60,000 tasks (`ops/load/`), `RATE_LIMIT_PER_MINUTE` for a raised limit; Lighthouse CI with budgets for public pages; visual snapshots in the official Playwright container (`ops/visual.sh`) | Performance tests on a dev DB with a dozen rows (the problems are invisible); cloud services (accounts); snapshots on the host (fonts and the OS make them unstable) |
| D47 | Versions and changelog | release-please (`simple`, one component per repository, `extra-files` bumps the versions of both packages) and Conventional Commits; deploy stays manual | `semantic-release` (publishes without a Release PR, worse for manual control); manual tags; separate package versions (overkill for an app deployed as one) |

## 4. Target architecture

### Backend

```
backend/
├─ prisma/ { schema.prisma, migrations/, seed.ts }
├─ src/
│  ├─ main.ts, app.module.ts
│  ├─ config/       env.schema.ts (zod), app-config.service.ts, config.module.ts
│  ├─ database/     prisma.module.ts (global), prisma.service.ts
│  ├─ common/
│  │  ├─ decorators/   current-user, public, roles
│  │  ├─ guards/       jwt-auth.guard (APP_GUARD), roles.guard
│  │  ├─ filters/      all-exceptions.filter, prisma-exception.filter
│  │  ├─ interceptors/ logging
│  │  ├─ pagination/   pagination-query.dto, paginate()
│  │  └─ types/        authenticated-user.type
│  ├─ health/
│  └─ modules/
│     ├─ auth/      dto/, strategies/jwt.strategy.ts, auth.{controller,service,module}.ts
│     ├─ users/     dto/, users.{controller,service,module}.ts
│     ├─ projects/  dto/, projects.{controller,service,module}.ts
│     ├─ tasks/     dto/, tasks.{controller,service,module}.ts
│     ├─ comments/  ...
│     └─ tags/      ...
└─ test/ { e2e/*.e2e-spec.ts, utils/ }
```

Modules talk only through exported services; circular dependencies (`forwardRef`) are forbidden.

### Frontend

```
frontend/src/
├─ app/         main.tsx, app.tsx, provider.tsx, router.tsx, routes/ (lazy pages)
├─ assets/
├─ components/  ui/ (shadcn), layouts/, errors/
├─ config/      env.ts (zod parsing of import.meta.env)
├─ features/    auth/, projects/, tasks/, comments/   (each: api/, components/, hooks/, types/, index.ts)
├─ hooks/       shared hooks
├─ lib/         api-client.ts, query-client.ts, auth-storage.ts, utils.ts
├─ testing/     setup.ts, test-utils.tsx, mocks/ (MSW)
└─ types/
```

Import direction: `shared (components, hooks, lib, config, types)` → `features` → `app`.
Features do not import each other: they are assembled together in `app/routes`.

## 5. Phases

Size: **S** — up to half a day, **M** — 1–2 days, **L** — 3+ days. Phases 0→1 are done strictly in order,
after that the backend (2–4) and frontend (5–6) can be done in parallel, provided the `/auth/login` and
`/auth/validate-token` contract stays stable until phase 6.

### Phase 0 — Critical security fixes (backend) · size M

Branch `refactor/phase-0-security`. Closes B1–B7. **Status: done 2026-11-16** (not committed).

- [x] 0.1 Write e2e tests (supertest) for the desired behavior: registration, login, `GET /tasks` without a token → 401, creating a task in someone else's project → 404, responses do not contain `password` (until phase 2.8 the tests run against the dev DB in Docker with unique emails and cleanup of created data)
- [x] 0.2 Remove `password` from all responses (`select` in the users service)
- [x] 0.3 Registration does not accept `role_id` (400 via `forbidNonWhitelisted`): always the `user` role
- [x] 0.4 Remove the public `GET /users/:email`; add a protected `GET /users/me`
- [x] 0.5 `JwtAuthGuard` on `POST /tasks`, `POST /comments`; `user_id` from the token; remove `user_id` from `TasksDto`/`CommentsDto`
- [x] 0.6 In `createTask` check that the user is the project owner; for someone else's → `NotFoundException`. The same for comments: you can comment only on a task you can see (you created it, it is assigned to you, or it is in your project)
- [x] 0.7 A global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts`; remove local `@UsePipes`
- [x] 0.8 One JWT mechanism: `AuthGuard('jwt')` + `JwtStrategy.validate` returns `{ id, email }`; delete the custom `canActivate`; replace `user.sub` with `user.id`
- [x] 0.9 CORS only for origins from the config (`CORS_ORIGINS`, local frontends by default); the app does not start without `SECRET_KEY`. Verified on a Docker image without `.env`. Locally Prisma itself loads `backend/.env` into `process.env`, so an automated test of this requirement is pointless, and full env validation is task 2.3

**Done when:** all the e2e tests from 0.1 are green; `curl /api/users/x@y.z` → 404/401; registration with `role_id` → 400, and without it creates the `user` role;
`POST /api/tasks` without a token → 401.

### Phase 1 — Repository, infrastructure, CI · size M

Branch `refactor/phase-1-infra`. Closes B8, B12 (partly), B13, I1–I4. **Status: done 2026-11-16** (not committed), except the optional 1.10.

- [x] 1.1 npm only: delete `backend/yarn.lock`; rename the packages to `flowsync-backend` / `flowsync-frontend`
- [x] 1.2 Node 24 LTS (or 22) in the Dockerfile, CI and `.nvmrc`; `engines` (`>=22`) in `package.json`. Added `.gitattributes` (`eol=lf`)
- [x] 1.3 `.env.example` in the root, `backend/`, `frontend/`; compose secrets via `${POSTGRES_PASSWORD}` from the root `.env`; rename the DB from `jira` to `flowsync`
- [x] 1.4 Compose: `docker-compose.yml` (prod) + `docker-compose.override.yml` (dev: bind mounts, `nest start --watch`, the frontend dev server); a `Dockerfile` with `dev`/`build`/`prod` targets; remove the `_prod` suffix from container names
- [x] 1.5 `frontend/nginx.conf`: an SPA fallback `try_files $uri /index.html` and a `/api/` → `backend:3000` proxy; the frontend calls `/api` (same-origin, no CORS)
- [x] 1.6 Docker: run as an unprivileged user (`node`, `nginx-unprivileged`); the backend healthcheck is a TCP port check for now (after phase 2 — `/api/health`). The production backend image keeps dev dependencies because startup runs `prisma db push` and the seed; phase 3 will remove this
- [x] 1.7 ESLint 9 (flat config) + Prettier in the backend; only Prettier in the frontend for now (`react-scripts` is tied to ESLint 8, the flat config is added in 5.7). Scripts `lint`, `format:check`; the old code is formatted, 3 warnings about `any` remain until phase 4
- [x] 1.8 CI `ci.yml` (PRs and pushes; the backend also runs e2e on a Postgres service; for the CRA build `CI=false` is set because the old code has warnings, remove in 5.x): backend — install, lint, typecheck, test, build, `prisma validate`; frontend — lint, test, build; `docker build` of both images. A separate `deploy.yml` only for `main` after CI success; tags `:<sha>` + `:latest`; the current major versions of actions as of November 2026 (checkout v7, setup-node v7, buildx v4, login v4, build-push v7); a Buildx cache
- [x] 1.9 Dependabot (npm, docker, github-actions)
- [ ] 1.10 Husky + lint-staged (pre-commit: prettier + eslint for changed files) — optional; postponed: it needs a root `package.json`, and CI already catches the same
- [x] 1.11 Update `README.md`: real folders, commands, ports (`5433` for Postgres), environment variables

**Done when:** `docker compose up --build` starts a production-like stack; `docker compose up` with the override gives hot reload;
refreshing `/dashboard` in the browser does not give a 404; CI is green on a PR.

### Phase 2 — Backend foundation · size L

Branch `refactor/phase-2-backend-foundation`. Closes B8, B11, B12. **Status: done 2026-11-16** (not committed).

- [x] 2.1 Upgrade Nest one major version at a time (10 → 11 → 12) following the official migration guides; Prisma — to the current 6.x (at least 6.2 for `omit`); the move to Prisma 7 is a separate step following their guide. After every step: tests green
- [x] 2.2 Directory restructuring: `conception/` → `common/*`; `prisma.service.ts` → `database/` (a global `PrismaModule`); features → `modules/*`; delete the custom `ParseIntPipe` in favor of the built-in one
- [x] 2.3 `config/`: a zod env schema (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `PORT`, `NODE_ENV`); the app fails at startup on an error; a typed `AppConfigService`; `SECRET_KEY` → `JWT_SECRET` (update `.env.example` and compose)
- [x] 2.4 `common/`: `@CurrentUser()`, `@Public()`, `@Roles()`, a global `JwtAuthGuard` (APP_GUARD) and `RolesGuard`; `AllExceptionsFilter` with a single error format; `PrismaExceptionFilter` (P2002 → 409, P2025 → 404, P2003 → 409); `PaginationQueryDto` and `paginate()`
- [x] 2.5 Swagger at `/api/docs` (not in production) with the Nest CLI plugin
- [x] 2.6 `helmet`, `@nestjs/throttler` (stricter for `/auth/*`), `enableShutdownHooks()`, `/api/health` (`@nestjs/terminus`), logging via `nestjs-pino` (JSON)
- [x] 2.7 TypeScript: full `strict: true` right away (enabled by default in TS 6); fix the errors
- [x] 2.8 Test infrastructure: a separate DB for e2e (a service in compose under the `test` profile), a DB cleanup helper, `jest-mock-extended` for service unit tests

**Done when:** the app does not start with an invalid env; `GET /api/health` → 200; Swagger opens;
Prisma errors return meaningful codes; `npm run lint && npm test && npm run test:e2e` are green.

**What turned out differently than planned:**
- Nest 10 → 11 → 12 was done in two steps with tests in between. `@nestjs/schematics@12` requires **TypeScript ≥ 6**, so TS was raised to 6.0 (D20); TS 6 changed defaults (`strict`, `types`, `rootDir`, `baseUrl`), and the configs were adjusted.
- Nest 12 packages are ESM (`import.meta`), **Jest cannot load them**, so the backend tests were moved to **Vitest + SWC** (D16); `jest`, `ts-jest`, `ts-node` were removed, and the seed runs through `tsx`.
- `@eslint/js` was pinned to 9.x (10.x requires ESLint 10): this was a hidden phase 1 bug.
- `JwtStrategy` reads the user from the DB on every request (the role is needed for `RolesGuard` and to reject tokens of deleted users). Roles are still rows of the `role` table (`common/types/role.type.ts`), and become an enum in phase 3.
- The `path` error in the 404 body was fixed via `originalUrl` (found by an e2e test).
- The rate limit is disabled in `NODE_ENV=test`; its behavior was verified manually (5 attempts/min, spoofing `X-Forwarded-For` does not bypass the limit).
- Not done within the phase: a `pino` request id (`nestjs-cls`) and Sentry (phase 7), the migration to Prisma 7.

### Phase 3 — Data model and migrations · size M

Closes B9, B10. **Status: done 2026-11-16** (not committed). **Phases 3 and 4 are done in one branch** `refactor/phase-3-4-domain` (renaming fields breaks services), but in separate commits.

- [x] 3.1 Rewrite `schema.prisma`: PascalCase models with `@@map("snake_case_plural")`, camelCase fields with `@map`; `createdAt`/`updatedAt`; `enum Role` (D3), `enum TaskStatus` (`TODO`, `IN_PROGRESS`, `DONE`); a single implicit m:n between `Task` and `Tag` (remove `task_tags`); assignees — `TaskAssignee` with a composite key; `ProjectMember` (project access); indexes on all FKs; `onDelete` policies; `description`/`image` optional
- [x] 3.2 `prisma migrate dev --name init`; commit `prisma/migrations` (the data is test data, so no data migration is needed)
- [x] 3.3 Compose: `prisma migrate deploy` instead of `db push` (a step in the start command; the `prisma` CLI moved to `dependencies`, the production image is built without dev dependencies)
- [x] 3.4 `prisma/seed.ts`: demo data (admin, user, project, a few tasks) — idempotent, dev only

**Done when:** `prisma migrate reset` + seed work on a clean DB; `prisma validate` passes; CI runs migrations on a test DB.

**What turned out differently than planned:**
- The new schema is incompatible with the old tables, and `migrate dev` on a DB created by `db push` proposes a `reset`. To lose nothing, the old `flowsync` was only **renamed** to `flowsync_backup_phase2` (it has 2 test users), and the migrations were applied to a new empty `flowsync`. The backup DB can be deleted: `DROP DATABASE flowsync_backup_phase2;`.
- Project access: the owner = `Project.ownerId`, other members are `ProjectMember` (the owner is not duplicated). Tags belong to a project (`@@unique([projectId, name])`). `onDelete`: the project owner `Restrict`, the author of a task/comment `SetNull`, child entities `Cascade`.
- The API contract changed: request and response fields are now camelCase (`projectId`, `taskId`, `createdById`, `authorId`, the user response: `role: "USER"` instead of `role_id`, `createdAt`). `/auth/login` and `/auth/validate-token` did not change.
- The role as an `enum` removed the `role` table and role seeding; registration no longer depends on data in the DB.
- A CI check was added: `prisma migrate diff ... --exit-code` fails if `schema.prisma` was changed without a migration (verified positively and negatively).
- The e2e tests now apply migrations (`migrate deploy`) instead of `db push`, so they verify the migrations' correctness themselves.
- Not done: `package.json#prisma` (the seed config) is deprecated in Prisma 7, which then needs a `prisma.config.ts`; this is part of the separate Prisma 7 migration step.

### Phase 4 — Backend modules · size L · **done 2026-11-16** (not committed)

Order: **auth → users → projects → tasks → comments → tags**. In each module complete the checklist:
DTOs (`Create`/`Update`/`Response`/`Query`), a thin controller, a service with an access check, Swagger decorators,
service unit tests, e2e (401 / 400 / 404 / success), removal of old code.

- [x] 4.1 **auth:** `POST /auth/register` (the role is always `USER`), `POST /auth/login`, `GET /auth/me`; a `bcrypt` cost from the config; login throttling; `validate-token` stays as deprecated until phase 6
- [x] 4.2 **users:** `GET/PATCH /users/me`; an admin `GET /users` (`@Roles('ADMIN')`)
- [x] 4.3 **projects:** CRUD; the list contains only projects where the user is a member; the owner manages members
- [x] 4.4 **tasks:** `GET/POST /projects/:projectId/tasks`, `GET/PATCH/DELETE /tasks/:id`; filters (status, assignee, tag), pagination, sorting; assigning assignees
- [x] 4.5 **comments:** list/create in a task; editing and deleting only by the author
- [x] 4.6 **tags:** CRUD within a project
- [x] 4.7 Service test coverage threshold ≥ 70% (`strict: true` was already enabled in phase 2)
- [x] 4.8 Export `openapi.json` with the `npm run openapi:export` script

**Done when:** there is no endpoint without a guard (except `@Public()`); no response contains `password`; there is no `any` in the code; all e2e tests are green.

**What turned out differently or additionally:**
- 30 endpoints were implemented (the list is in the README). Registration moved to `POST /auth/register`; `POST /users` was removed (the frontend did not call it). `POST /tasks` and `POST /comments` were replaced by nested routes. `/auth/login` (the `access_token` field) and `/auth/validate-token` are unchanged until phase 6.
- The access model (D24): a project is visible to its owner and members, to outsiders it "does not exist" (404); a member without the right gets 403. The ADMIN role only gives `GET /users`, not access to other people's projects.
- Permissions: members create and edit tasks, comments and tags; the project, its membership and tag deletion — only the owner; a task is deleted by its author or the owner; a comment is edited only by its author and deleted by the author or the owner (moderation).
- `PATCH /tasks/:id`: `assigneeIds` and `tagIds`, if passed, replace the current sets (an empty array clears); assignees must be project members, tags must be from the same project (otherwise 400).
- `GET /tasks` — tasks of all accessible projects with the same filters as the nested `GET /projects/:id/tasks`.
- Input hygiene: `@Trim()`, `@NormalizeEmail()` (email is case-insensitive, a duplicate → 409), password ≤ 72 characters (the bcrypt limit), `BCRYPT_ROUNDS` in the config.
- `openapi.json` is exported without a DB (Nest `preview` mode) and checked in CI; this is the basis for the typed client in phase 7. The service coverage threshold was also enabled in CI.
- Tests: 101 unit (the 70% service coverage threshold passes) and 117 e2e (the "owner / member / outsider / no token" matrix). Mutation check: disabling the owner check breaks 3 unit and 3 e2e tests.
- Not done: refresh tokens (phase 7), project member roles above `OWNER`/`MEMBER`, user search for invitations, soft delete.

### Phase 5 — Frontend foundation · size L

Branch `refactor/phase-5-frontend-foundation`. Closes F1, F2.

- [x] 5.1 A new Vite + React 19 + TypeScript (strict) project instead of CRA; only the logo was carried over; removed `react-scripts`, `jquery`, `react-bootstrap*`, `react-helmet`, `web-vitals`
- [x] 5.2 Create the structure from section 4, the `@/` alias
- [x] 5.3 Tailwind CSS 4 + shadcn/ui; base components (Button, Input, Label, Card, Dialog, Field instead of Form)
- [x] 5.4 `config/env.ts` (zod over `import.meta.env`), `VITE_API_URL=/api`; a Vite dev proxy `/api` → backend
- [x] 5.5 `lib/api-client.ts` (axios: baseURL, Authorization from `auth-storage`, 401 → sign out), `lib/query-client.ts`
- [x] 5.6 `app/router.tsx` on `react-router` v8: lazy routes, a protected branch, an error boundary, 404
- [x] 5.7 ESLint (typescript-eslint, react-hooks, jsx-a11y) + a `no-restricted-imports` rule for boundaries between features; Prettier
- [x] 5.8 Vitest + Testing Library + MSW; `test-utils.tsx` with providers
- [x] 5.9 A Dockerfile (build → nginx) and a dev mode in compose; frontend CI: format, lint, typecheck, test, build (without `CI=false`)

**Done when:** `npm run dev` (and in compose) gives HMR; `npm run build`, `lint`, `test` are green; the login page works through the proxy.

### Phase 6 — Frontend features · size L

Order: **auth → shell (layout, navigation) → projects → tasks → comments**. For each feature:
`api/` (request functions, query keys, hooks), `components/`, `types/`, tests, zero imports from other features.

- [x] 6.1 **auth:** `useLogin`, `useRegister` (a registration form and auto sign-in), `useMe` (`GET /auth/me` instead of `validate-token`), a single `lib/auth-storage.ts` module, a `ProtectedRoute` based on `useMe`
- [x] 6.2 Layout: a header, navigation, handling of loading/error/empty states
- [x] 6.3 **projects:** list, create, edit, delete
- [x] 6.4 **tasks:** a list with filters in the URL, create/edit (Dialog + form), status change, assignment; optionally a kanban
- [x] 6.5 **comments:** a comment stream in a task
- [x] 6.6 Delete the old CRA code (`Login.js`, `ProtectedRoute.js`, `AuthForm*.js`, etc.) and `validate-token` in the backend

**Done when:** a user goes through sign in → project → task → comment in the UI; the feature tests are green; there are no old `.js` files.

### Phase 7 — Contract, quality, security · size M–L

- [x] 7.1 Generate TS types from `openapi.json` (`openapi-typescript`); CI checks that the generated output is current (`npm run api:types`)
- [x] 7.2 Stronger authorization: a short access token (15 min) in memory + a refresh token in an `httpOnly` cookie with rotation and revocation (`RefreshToken` in the DB)
- [x] 7.3 Playwright e2e (registration → project → task → comment → reload → sign out) in CI on top of compose
- [x] 7.4 Observability: a request id (`X-Request-Id`, in logs and the error body; without `nestjs-cls`, see D27), structured logs (pino); Sentry was not added
- [x] 7.5 Security: CSP and headers in nginx, `npm audit` in CI, dependency checks by Dependabot
- [x] 7.6 Accessibility: `axe` in tests of key pages

### Phase 8 — Backlog (optional, in no particular order)

- [x] 8.1 a drag-and-drop kanban (`@dnd-kit/core`): a "List / Board" switch, status change by dragging (optimistic), a fallback — choosing the status on the card
- [x] 8.2 full-text search (PostgreSQL FTS: title, description, comments; prefixes; relevance sorting)
- [x] 8.3 CASL for fine-grained permissions (`common/casl/app-ability.ts`)
- [x] 8.4 an audit log and domain events (`GET /projects/:id/activity`; events are the basis for 8.5, 8.6 and "use-case classes")
- [x] 8.5 a queue and notifications: BullMQ + Redis, in-app notifications, emails via nodemailer; without configured mail and without Redis everything works (stubs in `.env.example`)
- [x] 8.6 real-time synchronization (a Nest gateway + socket.io)
- [x] 8.7 i18n (uk/en)
- [x] 8.8 file uploads (a project image, S3-compatible storage)
- [ ] 8.9 deploy to a VPS (Caddy/Traefik): **not done at the owner's instruction**
- [x] 8.10 use-case classes: not created separately; complex scenarios are solved with domain events (8.4), with no "just in case" abstractions

### Phase 9 — "Aurora" frontend redesign (D34) · size L · **done 2026-11-17** (not committed)

Frontend only: the API, DB schema and contract do not change. New texts go into `uk.ts` right away; each item ends with green lint/typecheck/tests and a check in the browser.

- [x] 9.1 theme tokens (oklch), Manrope, shadows and radii; a dark theme and a switcher in the header (`public/theme-init.js` against flicker)
- [x] 9.2 base components (Button, Input, Card, Badge, Select) and new Avatar, StatusIcon, Skeleton, tag and project colors derived from the name
- [x] 9.3 sign in and registration: a split screen with a live mini board (a card "floats" from To do to Done)
- [x] 9.4 the header (sticky, translucent) and the project list
- [x] 9.5 the project page: a header, status tabs with counters, a list, a board, a right column (members, tags), an activity feed
- [x] 9.6 the task page, notifications, dialogs, empty states and skeletons
- [x] 9.7 tests (update, add for the new), translations, axe, a browser check (light and dark, mobile width)

### Phase 10 — Production readiness (the local part) · size M · **done 2026-11-17**, except the VPS (not committed)

The deploy to a VPS is not done until the owner says so (8.9). Everything that can be done and verified locally is ready; the description is in `docs/OPERATIONS.md`.

- [x] 10.1 `GET /api/health/live` and `/api/health/ready` (DB + Redis if `REDIS_URL` is set), `/api/health` remains the readiness check
- [x] 10.2 `ops/backup.sh` (a dump + counts, a retry on changes during the dump, rotation) and `ops/restore-verify.sh` (a restore into a temporary DB, a check of rows and migrations)
- [x] 10.3 `ops/smoke-test.sh` (health, SPA fallback, 401, Swagger disabled, security headers)
- [x] 10.4 `docker-compose.vps.yml` + `ops/Caddyfile` (HTTPS, a health-aware proxy), `ops/deploy.sh` with a backup and automatic rollback, a manual `deploy-prod.yml` workflow
- [ ] 10.5 (VPS only, when the owner says so) set up the server, GitHub secrets, backup cron, the first deploy, verify the rollback on a live server
- [ ] 10.6 (VPS only) copy backups off the server

### Phase 11 — Observability · size M · **done 2026-11-17**, except Sentry source maps (not committed)

- [x] 11.1 OpenTelemetry: traces HTTP → Prisma → BullMQ → WebSocket in one trace (Jaeger in dev)
- [x] 11.2 `/metrics` (Prometheus): latency, errors, queue depth, number of sockets; a Grafana dashboard in the dev compose
- [x] 11.3 Sentry (frontend and backend). Source maps were **not done**: they need a Sentry account and an auth token
- [ ] 11.5 (from the VPS) alert delivery: Alertmanager or Grafana alerting, a Sentry project, source maps
- [x] 11.4 `docs/SLO.md`: 3 SLOs and alerts for them (`ops/observability/alerts.yml`, verified with `promtool`)

### Phase 12 — Event reliability and concurrency · size L · **done 2026-11-17** (not committed)

- [x] 12.1 A transactional outbox: the event is written to the DB in the same transaction, a worker publishes it (events are currently in memory and are lost on a crash)
- [x] 12.2 Idempotent consumers, retry with backoff, a dead-letter queue
- [x] 12.3 Optimistic concurrency for tasks (`version`, `409 Conflict`, the UI shows the conflict)
- [x] 12.4 A Socket.IO Redis adapter (several API instances)
- [x] 12.5 Cursor pagination for activity and comments
- [x] 12.6 A test of a crash between the write and the event publish

### Phase 13 — Second-level security · size M · **done 2026-11-17**, except 2FA (not committed)

- [x] 13.1 Password reset and email verification (on the existing queue)
- [x] 13.2 A password change revokes refresh tokens and access tokens; account lockout after 5 failed sign-ins
- [ ] 13.2b optional TOTP 2FA: **not done** (it needs a security settings page, a TOTP library, recovery codes; the UI does not yet even have a password change)
- [x] 13.3 CodeQL, Trivy for images, secret scanning, SBOM
- [x] 13.4 Upgrade to Prisma 7 (close the high-severity CLI vulnerability)
- [x] 13.5 `docs/THREAT_MODEL.md` (STRIDE, 1 page)

### Phase 14 — Quality in numbers · size M · **done 2026-11-17** (not committed)

- [x] 14.1 A coverage threshold in CI (backend and frontend); mutation testing (Stryker) for 7 key files, a score of 70.1% → 78.6%, a weekly `mutation.yml` job
- [x] 14.2 A k6 load test, `EXPLAIN ANALYZE` of slow queries, fixing N+1; before/after in `docs/`
- [x] 14.3 Playwright for sockets and file upload; visual snapshots of both themes
- [x] 14.4 Lighthouse CI with a budget
- [x] 14.5 Husky + lint-staged (the postponed 1.10)

### Phase 15 — Decision documentation · size S · **done 2026-11-17** (not committed)

- [x] 15.1 `docs/adr/`: ADRs for D1–D35 ("what was rejected and why")
- [x] 15.2 C4 diagrams (context, containers), a "what to do when…" runbook, `CONTRIBUTING.md`
- [x] 15.3 release-please: versions and CHANGELOG from Conventional Commits

## 6. Definition of Done (for every item)

1. The code is in the target structure and follows the rules in `AGENTS.md`.
2. `npm run lint`, types (`tsc --noEmit`), tests pass in the changed packages.
3. The new behavior is covered by a test (backend: a service unit test + an endpoint e2e; frontend: a component/hook test).
4. The Docker stack builds and starts (`docker compose up -d --build`), with a manual check of the changed scenario.
5. The old code that was replaced is removed; there is no commented-out code or `console.log`.
6. `[x]` is ticked in this plan; decisions that changed are reflected in the decision log.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Upgrading Nest/Prisma breaks dependencies | One major version at a time, green tests and a branch before each; check the `@nestjs/*` peer dependencies |
| Renaming the schema breaks all services | Phases 3–4 in one branch, a module-by-module migration; the DB holds only test data |
| An API contract change (snake_case → camelCase) breaks the frontend | A stable `/auth/login` and `/auth/validate-token` until phase 6; the rest is not yet used by the UI |
| Refactoring without tests | Phase 0.1 and the rule "every module with e2e" |
| Too large a scope | Each phase can be stopped after its "Done when"; phase 8 is optional |

## 8. Progress log

| Date | Phase / item | What was done | Notes |
|---|---|---|---|
| 2026-11-16 | Preparation | Docker on D:, the move from MySQL to PostgreSQL, role seeding, `.dockerignore`, this plan | Security holes B1–B7 were open |
| 2026-11-16 | Phase 0 (0.1–0.9) | Closed B1–B7: no `password` in responses, the role is not accepted, `/users/me` instead of `/users/:email`, a guard and a token author in tasks/comments, an access check, a global `ValidationPipe`, one JWT mechanism (`AuthGuard('jwt')`), CORS by list, `JwtModule.registerAsync`. 20 e2e tests green (`test/e2e/security.e2e-spec.ts`), live checks in Docker | Added `src/common/` (`@CurrentUser`, `AuthenticatedUser`) and `src/app.setup.ts`. Removed the broken template `test/app.e2e-spec.ts`. `validate-token` stays until phase 6 |
| 2026-11-16 | Phase 1 (1.1–1.9, 1.11) | npm-only and package names, Node 24, `.env.example` ×3, the DB `jira` → `flowsync` (`ALTER DATABASE`, data preserved), dev/prod compose + a `Dockerfile` with `dev`/`build`/`prod` targets, nginx (SPA fallback, `/api` proxy, security headers), unprivileged users, healthchecks, ESLint 9 + Prettier, CI (`ci.yml`) and deploy after CI (`deploy.yml`), Dependabot, a new README. Verified: lint/typecheck, 20 e2e, dev mode with hot reload, prod mode (200 on `/dashboard`, 401 through the proxy, API/DB ports closed) | Not committed. Removed the broken `App.test.js` (a CRA template). In CI the frontend build uses `CI=false`. 1.10 (Husky) postponed. For `deploy.yml` (`workflow_run`) the file must be in `main` |
| 2026-11-16 | Phase 2 (2.1–2.8) | Nest 10 → 11 → 12.5, TypeScript 6.0, Prisma 6.19, Vitest 5 + SWC instead of Jest, `tsx` for the seed. The structure `config/ database/ common/ health/ modules/`; zod env validation (`SECRET_KEY` → `JWT_SECRET`, ≥ 32 characters in production); global `JwtAuthGuard` (`@Public`), `RolesGuard` (`@Roles`), throttler; `AllExceptionsFilter` + `PrismaExceptionFilter` with a single error body; pagination; Swagger `/api/docs`; `helmet`; `nestjs-pino`; `/api/health` (now also used by the Docker healthcheck); `strict: true`; a separate test DB (`db_test`, the `test` profile). Verified: lint/types/build, 42 unit, 26 e2e, dev and prod mode in Docker (proxy, 404 on Swagger in prod, rate limit, fail-fast on a short secret) | Not committed. Needed: `JWT_SECRET` ≥ 32 characters for prod mode (the local `.env` currently has 19). The host Node 22.22.0 is below the `@nestjs/schematics` requirement (≥ 22.22.3 / 24.15): Docker and CI use Node 24 |
| 2026-11-16 | Phase 3 (3.1–3.4) | A new `schema.prisma`: PascalCase models with `@@map`, `createdAt`/`updatedAt`, `enum Role` and `TaskStatus`, `ProjectMember`, `TaskAssignee` with a composite key, project tags, an implicit m:n Task–Tag, indexes on all FKs, explicit `onDelete`. The `init` migration, `migrate deploy` in Docker, the `prisma` CLI in `dependencies` and a production image without dev dependencies, a schema drift check in CI, a demo seed (dev) instead of role seeding. Services, DTOs and tests moved to the new model. Verified: lint/types, 42 unit, 27 e2e (migrations on a fresh DB), the seed twice, a clean DB, dev and prod in Docker | Not committed. The old data is kept in `flowsync_backup_phase2`. The API contract changed (camelCase). Continued in phase 4 in the same branch |
| 2026-11-16 | Phase 4 (4.1–4.8) | The modules auth, users, projects (with members), tasks (filters, pagination, sorting, assignees, tags), comments, tags; 30 endpoints, response DTOs and Swagger, input normalization, `BCRYPT_ROUNDS`, a service coverage threshold, `npm run openapi:export` + an up-to-date check in CI. Verified: lint/types/build, 101 unit, 117 e2e, mutation, a live scenario in Docker on demo data and on a new flow | Not committed. The API contract changed (the frontend uses only `/auth/login` and `/auth/validate-token`, which are unchanged). Next — phase 5 (frontend) |
| 2026-11-16 | Phase 5 (5.1–5.9) | The old CRA was removed; Vite 8 + React 19 + TS strict, Tailwind 4 + shadcn/ui, TanStack Query, react-router 8 (lazy routes, an error boundary, 404), `config/env.ts`, `api-client` (Bearer, 401 → sign out), ESLint with feature boundaries, Vitest + MSW (47 tests), a Dockerfile (nginx, unprivileged), a dev mode in compose with HMR, frontend CI with lint/typecheck/test/build. Part of 6.1 was done ahead of the plan: `useLogin`, `useMe`, `ProtectedRoute`, `LoginForm`. Verified: format, lint, `tsc -b`, tests, `npm run build`, dev (proxy, signing in with a demo account in the browser, HMR) and prod (nginx :8080, SPA fallback, `/api`, sign in, the nginx user) | Not committed. Deviations: shadcn `field` instead of `form`, `background.jpg` and PWA assets were not carried over, the frontend requires Node ≥ 22.22 (react-router 8), MSW 3. Dependabot PRs against the old CRA `package.json` become obsolete. The feature boundaries do not catch relative imports (`../../x`) |
| 2026-11-16 | Phase 6 (6.1–6.6) | The features auth (registration with auto sign-in), projects (a list with search and pages in the URL, create/edit/delete, members), tasks (filters, sorting and page in the URL, a form with assignees and tags, status change, project tags), comments (add, edit, delete with owner moderation); a header with navigation, shared loading/error/empty states, a confirmation dialog, pagination. `validate-token` was removed from the backend (code, tests, `openapi.json`). Verified: frontend format/lint/typecheck, 104 tests; backend lint/types, 99 unit, 116 e2e | Not committed. Features do not import each other: data between them (project members → assignees, counters) is passed by the page in `app/routes`. The kanban was not done (optional). The `access_token` field was not renamed |
| 2026-11-16 | Phase 7 (7.1–7.6) | Frontend types are generated from `openapi.json` (CI checks), `LoginResponseDto` added. Session: a 15-min access token in memory, a refresh token in an `httpOnly` cookie with rotation, family revocation on reuse and a hash in the DB (the migration `add_refresh_tokens`), `POST /auth/refresh` and `/auth/logout`; the frontend restores the session after a reload and refreshes the token on a 401 with one shared request. `X-Request-Id` in logs, the header and the error body. nginx: CSP, Permissions-Policy, caching of `/assets/` (previously a stale `/static/`), `npm audit` in CI. Playwright e2e (the `e2e` job in CI), axe in tests of 5 pages and 2 dialogs. Verified: frontend format/lint/typecheck, 115+ tests, build; backend lint/types, 119 unit, 134 e2e; Playwright against the prod stack on :8080; the session, reload and sign-out in a browser (dev) | Not committed. Deviations: no `nestjs-cls` (D27). Known: the `prisma` CLI 6.x has a high-severity vulnerability (fixed only in Prisma 7), so CI blocks only critical in the backend; a password change does not yet revoke refresh tokens; all users must sign in again (the `localStorage` tokens no longer work) |
| 2026-11-16 | Phase 8 (8.1–8.8, 8.10) | A kanban board; full-text search (GIN indexes, relevance); CASL; an audit log + domain events + an activity feed; notifications (a bell, API, emails via BullMQ/Redis and nodemailer with stubs in `.env.example`); real-time (Socket.IO, rooms by access, cache updates, an nginx proxy); i18n uk/en with a completeness test; a project image (S3-compatible storage, type by bytes). Migrations `add_fulltext_search`, `add_audit_log`, `add_notifications`. Verified: backend lint/types, 225 unit, 201 e2e (with real sockets); frontend lint/types, 209 tests; live: an email reaches Mailpit through BullMQ and is retried after mail recovers, an upload to S3, board and bell updates without a reload (dev and prod through nginx), Playwright on the prod stack | Not committed. Deviations: images are uploaded through the API, not presigned URLs (D31); no `nestjs-cls`/`@nestjs/bullmq`; MinIO replaced with RustFS (the image is unavailable). **8.9 (deploy to a VPS) was not done.** Search is now prefix-based (`ELT` will not find `Delta`). The `image` field was removed from the project API (replaced by `hasImage`). The socket and upload endpoints are not covered by Playwright |
| 2026-11-17 | Phase 9 (9.1–9.7) | The "Aurora" redesign: oklch tokens, light and dark themes with a switcher (`public/theme-init.js`), Manrope for headings; new Avatar, StatusIcon, TagChip, SegmentedControl, Skeleton, OptionSelect (the shadcn Select instead of native); sign in and registration — a split screen with a live mini board; a sticky header, project cards with generated covers; the project page (a header with progress, status tabs with counters, a list, a board, a right column, an activity feed as a timeline); a task page with a details panel; notifications, dialogs, skeletons. Verified: format, lint, typecheck, 228 tests, build; Playwright e2e against the dev stack (:5173); in a browser the light and dark themes, phone width | Not committed. The backend and contract did not change. Added `@fontsource-variable/manrope`. The production-like stack does not start locally because of a short `JWT_SECRET` in `.env` (known since phase 2), so e2e on :8080 was not run. Tests: `asyncUtilTimeout` 5 s and `testTimeout` 15 s against flaky failures on a cold start |
| 2026-11-17 | Phase 10 (10.1–10.4) | Liveness/readiness (Redis only if configured), `ops/backup.sh` + `restore-verify.sh`, `smoke-test.sh`, `docker-compose.vps.yml` with Caddy, `deploy.sh` with a backup and automatic rollback, a manual `deploy-prod.yml`, `docs/OPERATIONS.md`. Verified: unit/e2e health, a backup and restore on the dev DB (12 tables, 5 migrations), a negative test (a forged counter → failure, the temporary DB is cleaned up), `docker compose config` of the overlay, `caddy validate`, a smoke test on the dev stack | Not committed. Not verified: `deploy.sh` and rollback on a live server, `deploy-prod.yml` on GitHub, a smoke test on a production-like stack (nginx headers; the prod stack does not start locally because of a short `JWT_SECRET`). 10.5–10.6 wait for the owner |
| 2026-11-17 | Phase 11 (11.1–11.4) | `/api/metrics` (prom-client: request duration by route template, the mail queue, sockets, the process), OpenTelemetry traces (`config/instrument.ts`), `bullmq-otel`, Sentry in the backend (a 5xx filter) and the frontend (`RouteError`), the `observability` profile (Prometheus, Grafana with a dashboard, Jaeger), alert rules, `docs/SLO.md`, a section in `docs/OPERATIONS.md`, nginx hides `/api/metrics`. Prometheus/health logs no longer clutter pino. Verified: backend lint/types, 241 unit, metrics and health e2e, frontend lint/types, tests; live: one trace "POST comment → Prisma → Socket.IO → BullMQ add/process" in Jaeger, the target host `up` and 5 rules `ok` in Prometheus, a Grafana dashboard with real data, `promtool`, a Sentry event reaches a fake receiver, the production nginx image (CSP, 404 on `/api/metrics`) | Not committed. New dependencies: backend `prom-client`, `@opentelemetry/*`, `@prisma/instrumentation`, `bullmq-otel`, `@sentry/nestjs`; frontend `@sentry/react`. Not verified: a real Sentry server (only a fake receiver), a frontend error in Sentry, alert delivery, rebuilding the prod stack with a proper `JWT_SECRET`. The Express instrumentation creates no spans (Express 5/ESM), and there are no Nest controllers in the trace: HTTP span → Prisma works. I did not change `npm audit` |
| 2026-11-17 | Phase 12 (12.1–12.6) | The outbox: `DomainEventsService.transact` (a write + an event in one transaction), `OutboxRelayService` (a `SKIP LOCKED` claim + lease, backoff, DEAD), idempotent subscribers (unique `eventId` in audit and `(eventId, userId)` in notifications; subscribers no longer swallow errors). 16 publish sites in 4 services were converted. Task versions (`version`, 409). The Socket.IO Redis adapter (`RedisIoAdapter`). Cursor pagination of activity and comments (frontend: `useInfiniteQuery`, "Show more"). Outbox metrics and alerts. Migrations `add_task_version`, `add_outbox`, `cursor_pagination_indexes`. Verified: backend lint/types, 265 unit, 223 e2e (with Redis): a crash after commit (before the claim and during delivery + lease expiry), retry and DEAD, redelivery, a transaction rollback, 4 parallel workers, 4 parallel PATCHes (1×200, 3×409), two API instances with real sockets (and a control test without the adapter), a cursor with no repeats under new writes; frontend lint/types, 234 tests, the coverage threshold (`test:cov`), Playwright e2e on the dev stack, live in dev: a PATCH with a current and a stale version (200/409), the activity cursor, outbox `DONE` and metrics | Not committed. **Breaks the API:** `PATCH /tasks/:id` requires `version`; `GET …/activity` and `GET …/comments` return `{ items, nextCursor }` without `meta`. A new dependency `@socket.io/redis-adapter`. Not verified: outbox load, a production-like stack, `RedisIoAdapter` with a real Redis cluster/Sentinel. Known: `audit_logs` and `notifications` have a nullable `event_id` (old rows without it); a conflict in the edit form does not offer a merge, it only shows an error and refreshes the data |
| 2026-11-17 | Phase 13 (13.1–13.5) | Password reset and email verification (backend: `UserTokensService`, 4 endpoints, emails with the token in the `#fragment`; frontend: the pages `/forgot-password`, `/reset-password`, `/verify-email`, a "verify your address" bar); account lockout (5 failures → 15 min), the same response time for an unknown email; a password change and reset invalidate all sessions (refresh tokens + `passwordChangedAt` for access); notification emails only to verified addresses. `ops/security-scan.sh` (Trivy, gitleaks, SBOM), the `security` job and `codeql.yml` in CI; Trivy found real vulnerabilities in the base images (npm in the Node image, Alpine packages in nginx): fixed in the Dockerfile. Prisma 6.19 → 7.10 (the `pg` adapter, `prisma.config.ts`), an empty `.trivyignore`. `docs/THREAT_MODEL.md`. The migration `add_account_security` (existing users marked as verified). Also fixed a phase 10 bug: the `ops/*.sh` scripts were in git without the executable flag (on Linux `./ops/deploy.sh` would not have run), now mode 100755. Verified: backend lint/types/format, 308 unit, 251 e2e (28 new for account security; two instances with Redis), frontend lint/types/format, 257 tests (axe for 3 new pages); live in dev: an email in Mailpit, verification and reset through a browser (the token removed from the address), Prisma 7 traces in Jaeger, Playwright; Trivy: the prod images have no fixable HIGH/CRITICAL, gitleaks: 58 commits clean (one false positive in the allowlist), SBOM 616 + 70 components; the production backend image with Prisma 7 starts and passes `migrate deploy` | Not committed. **Breaks the API:** `UserResponseDto` has `emailVerifiedAt`; `/auth/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification` appeared. New dependencies: `@prisma/adapter-pg`, `pg`, `@types/pg`. **Not done: TOTP 2FA** (see 13.2b). Not verified: `codeql.yml` and the `security` job on GitHub (the script was verified locally), real email delivery (only Mailpit and a fake transport), Prisma 7 performance under load (phase 14). The production backend image grew to ~1.1 GB (the Prisma 7 CLI is heavier): if that gets in the way, move migrations to a separate image |
| 2026-11-17 | Phase 14 (14.1–14.5) | **Performance:** k6 on 60,000 tasks and 180,000 comments found that `_count` in Prisma reads the whole table on every request (a `HashAggregate` over 180,000 rows); the counters are now a separate `groupBy` for the page's ids (tasks and projects); search was split into a `UNION` of two GIN indexes (744 → 180 ms) and limited to accessible projects (which also fixed the top-1000 selection among other people's tasks); there is no N+1 (2–3 queries per read). Throughput 31 → 98 requests/s, p95 2,121 → 600 ms (`docs/PERFORMANCE.md`). **Quality:** coverage thresholds (backend 63/72/58/63, frontend 88/80/85/88); Stryker 70.1 → 78.6% (7 files), tests fixed where they compared a constant with itself; Playwright: live updates between two browsers, file upload, 12 visual snapshots in a Linux container; Lighthouse CI with budgets (it found an LCP of 3.8 s on the mobile profile); Husky + lint-staged + a commit format check (`docs/QUALITY.md`). New dependencies: `@stryker-mutator/core`, `@stryker-mutator/vitest-runner` (backend); `@vitest/coverage-v8`, `@lhci/cli` (frontend); `husky`, `lint-staged` (root). The `RATE_LIMIT_PER_MINUTE` variable. Verified: backend lint/types/format, 333 unit, 251 e2e; frontend lint/types/format, 260 tests, Playwright 4/4 on the dev stack, visual snapshots stable across two runs, `lhci` passes; live k6 before and after | Not committed. **Not done:** search is still 871 ms p95 (a candidate: a stored `tsvector` column, not measured) and writes 400–515 ms p95 (several commits per request, see ADR 37); LCP 3.8 s (the 4.2 s budget only pins the level). Snapshots and k6 numbers are reproducible only on the same machine. The `mutation.yml`, `visual`/`lighthouse` jobs on GitHub were not run |
| 2026-11-17 | Phase 15 (15.1–15.3) | `docs/adr/` (47 ADRs from the decision log + an index, 16 with "Consequences" and "When to revisit" sections), `docs/ARCHITECTURE.md` (C4: context, containers, components, the new-comment sequence, deployment; all 5 Mermaid diagrams verified by rendering), `docs/RUNBOOK.md` (10 scenarios: symptom → check → action), `CONTRIBUTING.md`, release-please (`release-please-config.json`, a manifest, a workflow; the versions of both packages and `CHANGELOG.md`), D44–D47 | Not committed. Not verified: the `release-please` workflow on GitHub (it needs a run on `main`). Version 0.1.0 is nominal |
| 2026-11-18 | Documentation language | All Markdown documentation (README, CONTRIBUTING, AGENTS, `docs/`, ADRs) was translated from Ukrainian to English at the owner's request | The app's UI dictionary (`uk.ts`) stays Ukrainian; conversation with the owner stays Ukrainian |
