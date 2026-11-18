# How to work on FlowSync

This file is for people (and for you half a year from now). The rules for AI agents are in `AGENTS.md`; they are consistent with this file.
If something here contradicts the code, fix whichever is wrong and say so in the PR.

## Quick start

You need Docker (Compose v2) and Node ≥ 22.22 (24 recommended, `.nvmrc`).

```bash
cp .env.example .env && cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env   # and fill in the secrets
docker compose up -d --build        # the whole dev stack: backend, frontend, Postgres, Redis, Mailpit, S3
npm install                         # in the root: only git hooks (Husky); the app is backend/ and frontend/ separately
```

Addresses: the app `http://localhost:5173`, the API `http://localhost:3000/api`, mail (Mailpit) `http://localhost:8025`.
Demo accounts: `admin@flowsync.test` and `user@flowsync.test`, password `password-123` (for development only).

## Structure

Two independent npm packages with no monorepo tooling (ADR 15): `backend/` (NestJS) and `frontend/` (React). The root has only a `package.json`
for git hooks. Overview — `docs/ARCHITECTURE.md`; decisions and why — `docs/adr/`; code rules — `backend/AGENTS.md` and `frontend/AGENTS.md`.

## The change process

1. A branch from `main`: `feat/<name>`, `fix/<name>`, `refactor/<name>`, `docs/<name>`.
2. Small steps: one logical step — one commit. Do not mix refactoring with new behavior.
3. Write the test together with the code (see "Tests"). A new security check without a test is not considered done.
4. Before a PR, run what CI will run (below). The hooks will do part of it for you.
5. A PR is small and explains **why**, not just what. A new decision that changes the architecture is also a new ADR.

### Commit messages: Conventional Commits

The format is `type(scope): subject`. This is not a formality: versions and `CHANGELOG.md` are built **automatically** from the messages (release-please),
and the `commit-msg` hook rejects messages that do not match the format.

| type | when | in the version |
|---|---|---|
| `feat` | a new user-facing capability | minor |
| `fix` | a bug fix | patch |
| `perf` | a speedup with no behavior change | patch |
| `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style` | everything else | no version change |
| `feat!`, `fix!` or `BREAKING CHANGE:` in the body | an incompatible change to the API or behavior | major (while `0.x` — minor) |

Examples: `feat(tasks): add status filter`, `fix(auth): refuse tokens issued before a password change`, `perf(search): use both GIN indexes`.
Language: identifiers, branches, commits and test names are in English; documentation is in English as well; conversation with the owner is in Ukrainian.

## What to run

```bash
# backend (from the backend/ folder)
npm run lint && npm run typecheck && npm run format:check
npm test                  # unit; npm run test:cov adds the coverage threshold
docker compose --profile test up -d db_test && npm run test:e2e     # e2e on a separate DB (there is a two-instance test too: TEST_REDIS_URL=redis://localhost:6380)
npm run test:mutation     # Stryker: would the tests fail if the code were wrong (a few minutes)
npm run openapi:export    # after an API change: update openapi.json

# frontend (from the frontend/ folder)
npm run lint && npm run typecheck && npm run format:check
npm run test:cov          # Vitest with the coverage threshold
npm run api:types         # after changing openapi.json: update the generated types
npm run test:e2e          # Playwright (the stack first; locally against dev: E2E_BASE_URL=http://localhost:5173)
./ops/visual.sh           # visual snapshots of public pages in a container (update — accept the new look)
npm run lighthouse        # performance budgets

# security and performance (from the root)
./ops/security-scan.sh all    # Trivy for images, gitleaks for history, SBOM
./ops/load/run.sh             # a k6 load test on a copy with 60,000 tasks
```

Git hooks (Husky, installed by `npm install` in the root):

- `pre-commit` — ESLint and Prettier **only for changed files** (lint-staged);
- `commit-msg` — checks the Conventional Commits format;
- `pre-push` — backend and frontend types.

Hooks help but do not replace CI: run the full set yourself. Do not bypass the hooks (`--no-verify`) without a good reason.

## Tests: what and why

- **Unit** (next to the code): every public service method, guards, filters; Prisma is mocked.
- **Backend E2E**: every endpoint — without a token (401), an invalid body (400), someone else's resource (404), success; the real `AppModule` and DB.
- **Frontend**: components and hooks with MSW; accessibility via axe on every page and dialog.
- **Playwright**: end-to-end scenarios in a browser, including live updates between two browsers and file upload.
- **Mutation tests** and the **coverage threshold** — so that tests actually check something (`docs/QUALITY.md`).

A test describes behavior, not implementation: `it('returns 404 when the task belongs to another project')`.

## Databases and migrations

The schema changes through `npx prisma migrate dev --name <verb_noun>` in `backend/`; a new migration is committed together with `schema.prisma`.
**An already committed migration is not edited.** Migrations are written to be backward compatible (first add, then remove in the next release),
because rolling back an image does not undo migrations (`docs/OPERATIONS.md`). Destructive commands (`migrate reset`, `down -v`) — only on a dev DB and deliberately.

## Security

- Secrets only in `.env` (not committed); variables go through `backend/src/config/env.schema.ts`.
- A new public route: `@Public()` + a reason comment + a rate limit + a "no token" test (`docs/THREAT_MODEL.md`).
- If you find a vulnerability, do not open a public issue; write to the owner directly.

## Releases

Versions and `CHANGELOG.md` are created by **release-please** from the commit history: when `feat`/`fix` land in `main`, the bot opens a "Release PR";
merging that PR creates the `vX.Y.Z` tag and a changelog entry. Versions are not changed by hand. Deploying to the server is a separate manual action
(the "Deploy to production" workflow, `docs/OPERATIONS.md`), not a consequence of a release.

## When something breaks

`docs/RUNBOOK.md`: symptoms, what to check, what to do.
