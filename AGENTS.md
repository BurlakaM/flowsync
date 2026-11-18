# FlowSync — instructions for AI agents

This file is read by Claude Code, Codex, Cursor, Copilot and other agents. For humans there is `README.md`.
Details per part: `backend/AGENTS.md`, `frontend/AGENTS.md`. The work plan: `docs/ARCHITECTURE_PLAN.md`.

## About the project

FlowSync is a pet project, a Jira-style task tracker: projects, tasks, comments, tags, assignees.
The owner is deliberately moving the project to a new architecture and learning from it, so **explain "why"**, not just "what".

## Language

- Conversation with the owner is in **Ukrainian**.
- Identifiers, branch names, commit messages, test names — in **English**.
- Code comments — in English, and only when they explain "why", not "what".
- Documentation (`docs/`, README, AGENTS, CONTRIBUTING) — in **English**.

## Stack

| Layer | Current state | Target (after the plan) |
|---|---|---|
| Backend | NestJS 12, Prisma 7.10 (the `pg` adapter), JWT (Passport), TypeScript 6 (strict), Vitest, Node 24 LTS | + the DB schema and modules per the plan (phases 3–4) |
| DB | PostgreSQL 16, `prisma migrate` migrations, PascalCase models, `enum Role` | the same |
| Frontend | React 19, Vite 8, TypeScript (strict), Tailwind 4 + shadcn/ui ("Aurora" design, light and dark themes), TanStack Query, react-router 8, Vitest + MSW | the same; types generated from OpenAPI, e2e on Playwright |
| Infrastructure | Docker Compose (dev override + prod), an nginx proxy, Redis (queue), Mailpit and S3 storage in dev, CI with checks | deploy to a VPS (phase 8.9, not done yet) |

The repository consists of two independent npm packages: `backend/` and `frontend/` (no monorepo tooling). `npm` only.

## Commands

```bash
docker compose up -d --build                         # the whole stack, dev mode (override, hot reload)
docker compose -f docker-compose.yml up -d --build   # production-like mode (only :8080, nginx proxies /api)
docker compose logs -f backend                       # logs
docker compose down                                  # stop (DB data is kept; do NOT add -v)
```

Addresses in dev mode: frontend `http://localhost:5173`, API `http://localhost:3000/api`, Postgres `localhost:5433`
(DB `flowsync`, user and password from the root `.env`). In production-like mode: `http://localhost:8080` (the API via `/api`).
Secrets live in `.env`, `backend/.env`, `frontend/.env` (not committed; examples are `.env.example`).
Dev-seed demo accounts: `admin@flowsync.test` (ADMIN) and `user@flowsync.test`, password `password-123` (for development only).

Locally without Docker (the DB must run in Docker):

```bash
cd backend && npm run start:dev      # API with watch
cd backend && npm test               # unit
cd backend && npm run test:e2e       # e2e (first: docker compose --profile test up -d db_test)
cd backend && npm run lint           # ESLint 9; lint:fix fixes
cd backend && npm run format:check   # Prettier; npm run format formats
cd backend && npm run typecheck      # tsc --noEmit
cd backend && npx prisma migrate dev --name <verb_noun>   # a new migration after changing schema.prisma (DB on :5433)
cd backend && npm run openapi:export  # after an API change: update backend/openapi.json (CI checks it)
cd frontend && npm run dev           # Vite with HMR
cd frontend && npm test              # Vitest; also lint, typecheck, build, format:check
cd frontend && npm run api:types     # after an API change (and openapi.json): update src/types/api.generated.ts (CI checks it)
./ops/load/run.sh                   # a k6 load test on a DB copy with 60,000 tasks (docs/PERFORMANCE.md)
cd backend && npm run test:mutation  # Stryker: would the tests notice a bug in the key services (docs/QUALITY.md)
cd frontend && npm run lighthouse    # performance budgets; ./ops/visual.sh — visual snapshots in a container
./ops/security-scan.sh all          # Trivy (images), gitleaks (git history), SBOM; all in Docker, no accounts
./ops/backup.sh && ./ops/restore-verify.sh   # a DB backup and proof that it can be restored (docs/OPERATIONS.md)
cd frontend && npm run test:e2e      # Playwright against the production-like stack on :8080 (first: docker compose -f docker-compose.yml up -d --build)
```

## Documentation worth knowing

`docs/ARCHITECTURE.md` (C4), `docs/adr/` (decisions and why), `docs/RUNBOOK.md` (what to do in incidents), `docs/OPERATIONS.md`, `docs/SLO.md`,
`docs/PERFORMANCE.md`, `docs/QUALITY.md`, `docs/THREAT_MODEL.md`, `CONTRIBUTING.md`. A new architectural decision = a row in the plan log **and** a new ADR.
Commit messages are Conventional Commits (the `commit-msg` hook checks this; release-please builds versions and the CHANGELOG from them).

## Workflow

1. **Read `docs/ARCHITECTURE_PLAN.md`** and determine the current phase (the first phase with unticked items).
   Work only within it; do not mix refactoring with new features in one commit.
2. **Write new logic in the target structure** (see section 4 of the plan), even if the old code has not been moved yet.
   Move old code only as part of the corresponding phase; outside a phase touch it only to fix security or a bug.
3. **Small steps:** one logical step — one commit. The Conventional Commits format:
   `feat(tasks): add status filter`, `fix(auth): ...`, `refactor`, `test`, `chore`, `docs`.
4. **Do not run `git commit` / `git push` without the owner's direct request.** Branches: `refactor/phase-N-<name>`, `feat/<name>`, `fix/<name>`.
   **Commit messages and PR descriptions carry no attribution trailers** (no `Co-Authored-By`, no "Generated with Claude Code"): the owner asked for this explicitly.
5. **After finishing an item** tick `[x]` in the plan and add a row to the "Progress log".
6. **A new library outside the decision log** (section 3 of the plan): first propose it to the owner and add a row to the log.
7. **Doubt or a contradiction** between these rules and the existing code: do not guess, ask or propose updating the rule.

## Definition of Done

A change is complete only when:

1. The code follows the rules from `backend/AGENTS.md` / `frontend/AGENTS.md`.
2. Lint, types (`tsc --noEmit`) and tests pass in the changed packages (if the script already exists).
3. The new behavior is covered by a test.
4. The stack builds and starts (`docker compose up -d --build`), and the changed scenario is verified manually (curl/browser).
5. The old code that was replaced is removed; there is no commented-out code or `console.log`.
6. A report to the owner: what changed, what was verified, what was **not** verified.

## Security (always mandatory)

- Never return `password` or other secret fields in API responses.
- Never trust a user identifier from the request body, only from the token.
- Every endpoint is closed by default (the global `JwtAuthGuard`); publicity only via `@Public()` and a comment with the reason.
- All environment variables pass through the zod schema `backend/src/config/env.schema.ts`; read only through `AppConfigService`.
- All input is validated by DTOs; no secrets in code and commits; `.env` is never committed.
- Resource access check: someone else's resource → `404`, not `403`.

## Forbidden without the owner's explicit permission

- `docker compose down -v`, `docker volume rm`, `docker system prune`, `prisma migrate reset`, `prisma db push --force-reset`:
  anything that destroys DB data.
- Changing secret values in `.env`, printing them in replies or logs.
- `git push --force`, rewriting history, changing already committed Prisma migrations.
- Upgrading major dependency versions outside the plan.
- Deleting files outside the list that explicitly follows from the task.

## Common mistakes to avoid

- Adding new logic to old files instead of the target structure.
- Fixing a symptom (for example, `any`, `@ts-ignore`, `eslint-disable`) instead of the cause.
- Creating "just in case" abstractions (repositories, factories, generic base classes) without a second use.
- Silently swallowing errors (`catch {}`); handle errors only where there is something to do with them.
- Inventing library APIs: if unsure of a signature, check the documentation or the installed version in `node_modules`.
