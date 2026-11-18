# FlowSync

A pet project: a Jira-style task tracker (projects, tasks, comments, tags, assignees).
The backend is **NestJS**, the frontend is **React**, the database is **PostgreSQL**, and everything runs through **Docker Compose**.
The project is gradually moving to a new architecture; the plan and status: [docs/ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md).

## Technologies

| Layer | Now |
|---|---|
| Backend | NestJS 12, Prisma 7.10, Passport JWT, TypeScript 6, Vitest |
| Frontend | React 19, Vite, TypeScript, Tailwind 4 + shadcn/ui, TanStack Query, Vitest |
| Database | PostgreSQL 16 |
| Runtime | Node.js 24 LTS (`.nvmrc`) |
| Infrastructure | Docker Compose, nginx, GitHub Actions |

## Structure

```
flowsync/
├─ backend/                  NestJS API (prefix /api)
│  ├─ prisma/                Prisma schema and seed
│  ├─ src/, test/
│  └─ Dockerfile             targets: dev, build, prod
├─ frontend/                 React SPA
│  ├─ nginx.conf             SPA fallback and /api → backend proxy
│  └─ Dockerfile             targets: dev, build, prod
├─ docker-compose.yml        production-like stack
├─ docker-compose.override.yml   development mode (picked up automatically)
├─ docs/ARCHITECTURE_PLAN.md the plan for moving to the new architecture
├─ AGENTS.md                 rules for AI agents
└─ .github/                  CI, deploy, Dependabot
```

## Quick start (development)

1. Install Docker (Docker Desktop with WSL2 on Windows).
2. Create the environment files from the examples:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Fill in `POSTGRES_PASSWORD` in `.env` and `JWT_SECRET` in `backend/.env`. Passwords must be URL-safe:
   the DB password is substituted into `DATABASE_URL`. In `backend/.env` the password in `DATABASE_URL` must match `POSTGRES_PASSWORD`.

3. Start the stack:

   ```bash
   docker compose up -d --build
   ```

| Service | Address |
|---|---|
| Frontend (Vite dev server) | http://localhost:5173 (`/api` requests are proxied to the backend) |
| API | http://localhost:3000/api |
| Swagger (non-production only) | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5433` (user and password from `.env`, DB `flowsync`) |
| Mailpit (a fake mail server: all dev-mode emails) | http://localhost:8025 |
| Redis (queue) | `localhost:6380` |

The backend and frontend rebuild automatically when files in `backend/src` and `frontend/src` change.
On container start the backend applies migrations (`prisma migrate deploy`) and fills the DB with demo data (seed, dev only):
the accounts `admin@flowsync.test` and `user@flowsync.test`, password `password-123`, and a "Demo project" with a few tasks.

To stop: `docker compose down`. **Do not add `-v`**: it deletes the DB data.

## Production-like run

```bash
docker compose -f docker-compose.yml up -d --build
```

Only the frontend is published to the outside: http://localhost:8080. nginx serves the React build and proxies `/api/` to the backend,
so CORS is not needed. The backend and DB ports are not exposed to the host. Swagger is disabled in this mode. On start the backend applies migrations;
the demo seed is not run here.

In production mode `JWT_SECRET` must be **at least 32 characters**, otherwise the backend will not start. To generate one:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

## Commands without Docker

The DB must still run in Docker (`docker compose up -d db`). Node 22+ is required (24 recommended).

```bash
cd backend
npm ci
npm run start:dev       # API with watch
npm run lint            # ESLint 9
npm run format:check    # Prettier
npm run typecheck       # tsc --noEmit
npm test                # unit (Vitest)
npm run test:e2e        # e2e on a separate DB, first: docker compose --profile test up -d db_test

cd frontend
npm ci
npm run dev             # Vite with HMR (proxy /api → localhost:3000)
npm run format:check
npm run lint
npm run typecheck
npm test                # Vitest + Testing Library + MSW + axe (accessibility)
npm run api:types       # types from ../backend/openapi.json (after an API change; CI checks it)
npm run test:e2e        # Playwright: needs a running production-like stack (:8080) and Chrome
npm run build
```

## API

All routes have the `/api` prefix and require `Authorization: Bearer <token>`, except registration, login, `refresh`, `logout` and `/health`.
Interactive documentation: Swagger at `/api/docs` (dev only); the full description is in [backend/openapi.json](backend/openapi.json).

| Resource | Endpoints |
|---|---|
| notifications | `GET /notifications` (`?unread=true`), `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| activity | `GET /projects/:id/activity` |
| project image | `PUT`/`DELETE`/`GET /projects/:id/image` (multipart, field `file`) |
| auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| users | `GET`/`PATCH /users/me`, `GET /users` (ADMIN only: pagination, `?search=`) |
| projects | `GET`/`POST /projects`, `GET`/`PATCH`/`DELETE /projects/:id`, `GET`/`POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` |
| tasks | `GET /tasks`, `GET`/`POST /projects/:id/tasks`, `GET`/`PATCH`/`DELETE /tasks/:id` |
| comments | `GET`/`POST /tasks/:id/comments`, `PATCH`/`DELETE /comments/:id` |
| tags | `GET`/`POST /projects/:id/tags`, `PATCH`/`DELETE /tags/:id` |

Session: `POST /auth/login` returns a short-lived access token (15 min) in the body and sets the refresh token in an `httpOnly` cookie
(`SameSite=Strict`, `Path=/api/auth`). The frontend keeps the access token in memory only; after a page reload or on a 401
it calls `POST /auth/refresh`, and the server issues a new pair (rotation: each refresh token works once). Reusing
an already used token is treated as theft and closes the whole session. `POST /auth/logout` revokes the session. Every response has an
`X-Request-Id` header (logs and the error body carry it too).

Rules: a project is visible to its owner and members (to outsiders it appears not to exist, `404`). Members create and edit tasks,
comments and tags; only the owner changes the project, members and tags; a task is deleted by its author or the owner; a comment is edited only by its author.
Lists are paginated with `?page=&limit=`, and tasks also have the filters `status`, `assigneeId`, `tagId`, `search` and the sorting `sortBy`/`order`.
After changing the API, update the description: `cd backend && npm run openapi:export` (CI checks that `openapi.json` is current).

## Features worth knowing

- **Board.** The project page has a "List / Board" switch. Dragging a card between columns changes its status; every card also has a regular status picker.
- **Task search.** Full-text (PostgreSQL): words from the title, description and comments, prefix matching (`log` finds `login`), all words must match. A "Best match" sort (`sortBy=relevance`).
- **Permissions.** All the "who can do what" rules are described in one place: `backend/src/common/casl/app-ability.ts`.
- **Activity and events.** Services publish domain events; the audit log (`GET /projects/:id/activity`), notifications and real-time updates subscribe to them.
- **Notifications.** About assignment to a task, comments on your tasks and being added to a project: in the app (the bell in the header) and, if mail is configured, by email through the queue.
- **Real-time.** Socket.IO at `/api/socket.io`, authorized by a token in the handshake; a client hears only projects it has access to, and events only announce what changed (the client fetches data through the API).
- **Languages.** The interface is in English and Ukrainian (a switcher in the header, the choice is stored in the browser). Texts are sentence keys in the code, the translation is `frontend/src/i18n/uk.ts`; a test checks that everything is translated. API messages stay in English.
- **Project image.** Uploaded through the API (the type is checked by content, PNG/JPEG/WebP up to 2 MB), stored in S3-compatible storage and served only to project members.

## Database and migrations

The schema is described in `backend/prisma/schema.prisma` (PascalCase models; in the DB, tables and columns are `snake_case`). Schema changes go only through migrations:

```bash
cd backend
npx prisma migrate dev --name add_task_due_date   # creates and applies a migration (needs the DB on :5433)
npx prisma migrate deploy                          # applies existing migrations (this is how Docker starts)
npx prisma db seed                                 # demo data (dev only, idempotent)
```

The `backend/prisma/migrations/` folder is committed, and **already committed migrations are not edited**. CI checks that `schema.prisma` has not drifted
from the migrations (without a new migration the build fails). `prisma migrate reset` wipes the DB, so apply it only to a dev database.

## Environment variables

| File | Variable | Purpose |
|---|---|---|
| `.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | the DB in Docker and the backend's `DATABASE_URL` in compose |
| `backend/.env` | `JWT_SECRET` | the JWT signing secret; ≥ 32 characters in production. The app does not start without it |
| `backend/.env` | `DATABASE_URL` | the DB for running on the host; overridden in compose |
| `backend/.env` | `JWT_EXPIRES_IN` | optional: the access token lifetime (`15m`, `1h`), default `15m` |
| `backend/.env` | `REFRESH_TOKEN_TTL_DAYS` | optional: the session lifetime (the refresh cookie), 1-90 days, default `7` |
| `backend/.env` | `COOKIE_SECURE` | optional: `true` when the site runs over HTTPS (the cookie then travels only over a secure channel); keep `false` for `http://localhost` |
| `backend/.env` | `CORS_ORIGINS` | optional: allowed origins, comma-separated |
| `backend/.env` | `LOG_LEVEL`, `PORT` | optional: the log level (default `info`), the port (default `3000`) |
| `backend/.env` | `BCRYPT_ROUNDS` | optional: bcrypt cost (4-15), default `10` |
| `backend/.env` | `TRUST_PROXY` | optional: the number of reverse proxies in front of the API (`1` in the production compose), needed for a correct IP in the rate limit |
| `backend/.env` | `REDIS_URL` | optional: Redis for the mail queue (set in compose). Without it, emails are sent inside the API process, without retries |
| `backend/.env` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | optional: mail. Emails are enabled when `SMTP_HOST` and `MAIL_FROM` are set; without them nothing is sent and nothing fails (notifications stay in the app). Templates with explanations are in `backend/.env.example` |
| `backend/.env` | `APP_URL` | optional: where the links in emails point (default `http://localhost:5173`) |
| `backend/.env` | `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | optional: file storage (project images) in any S3-compatible service. Uploading is enabled when the key pair is set; without it everything else works and uploads answer `503`. The dev compose runs local storage with test keys |
| `backend/.env` | `RATE_LIMIT_PER_MINUTE` | optional: requests per minute from one IP to the API (default 100; login and registration have their own stricter limits). Raised only for load tests |
| `backend/.env` | `OUTBOX_POLL_INTERVAL_MS` | optional: how often the outbox relay looks for undelivered events, ms (default 2000; 0 disables the loop). Events are also delivered right after the request; the relay is only a safety net |
| `backend/.env` | `METRICS_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `SENTRY_DSN` | optional: observability (a token for `/api/metrics`, where to send traces, Sentry). Disabled without them; see `docs/OPERATIONS.md` |
| `frontend/.env` | `VITE_SENTRY_DSN` | optional: error reports from the browser (baked in at build time; the host must be added to the CSP) |
| `backend/.env` | `TEST_DATABASE_URL` | optional: the DB for e2e (default `localhost:5434/flowsync_test`) |
| `frontend/.env` | `VITE_API_URL` | optional: the API base address, default `/api` (same origin; `/api` in the production image) |
| `frontend/.env` | `VITE_PROXY_TARGET` | optional: where the Vite proxy sends `/api` in dev, default `http://localhost:3000` (`http://backend:3000` in compose) |

`.env` files are not committed; only `.env.example` is in the repository. All backend variables are validated by a zod schema
(`backend/src/config/env.schema.ts`): on an error the app does not start and shows what exactly is wrong.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): on every PR and push to `main`. Backend: `prisma validate`, Prettier, ESLint, types, unit and e2e
  (on Postgres in a service container), a check that `schema.prisma` has not drifted from the migrations, the build. Frontend: Prettier, ESLint, a check of the generated types, types, tests, the build. Both packages are checked with `npm audit`. A separate `e2e` job brings up the production-like stack and runs Playwright. Then the Docker image build.
- **Deploy** (`.github/workflows/deploy.yml`): after a successful CI on `main` it publishes images to Docker Hub:
  `<DOCKER_USERNAME>/flowsync-back` and `<DOCKER_USERNAME>/flowsync-front` with the tags `:<commit sha>` and `:latest`.
  The repository secrets `DOCKER_USERNAME` and `DOCKER_PASSWORD` (a Docker Hub access token) are required.
- **Dependabot** proposes npm, Docker and GitHub Actions updates weekly.

## Contributing

1. Fork, a `feat/<name>` or `fix/<name>` branch.
2. Commits follow Conventional Commits (`feat(tasks): ...`), in English.
3. Before a PR, run `lint`, `format:check`, `typecheck` and the tests locally.

## License

MIT.
