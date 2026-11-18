# FlowSync — quality in numbers

Passing tests do not yet prove that they check anything. This document collects **how we measure quality**, what numbers we have now and where they
are weak. The numbers are as of 2026-11-17; sources and commands are in the table. Performance is covered separately in `docs/PERFORMANCE.md`.

| What | With | Command | Now |
|---|---|---|---|
| Backend unit tests | Vitest | `cd backend && npm test` | 333 tests |
| Backend E2E (real DB) | Vitest + supertest | `npm run test:e2e` | 251 tests, including two API instances with Redis |
| Frontend unit tests | Vitest + Testing Library + MSW | `cd frontend && npm test` | 260 tests (+ axe on every page) |
| End-to-end scenarios | Playwright, a real browser | `npm run test:e2e` | 4 tests: the full path, **live updates between two browsers**, image upload |
| Backend coverage | v8, threshold in `vitest.config.ts` | `npm run test:cov` | lines 68%, branches 78%, functions 64% |
| Frontend coverage | v8, threshold in `vite.config.ts` | `npm run test:cov` | lines 94%, branches 85%, functions 90% |
| **Mutation score** | Stryker | `cd backend && npm run test:mutation` | **78.6%** (up from 70.1% at the start) |
| Visual regressions | Playwright in a Linux container | `./ops/visual.sh` | 12 snapshots: 3 pages × 2 themes × 2 screens |
| Performance budgets | Lighthouse CI | `cd frontend && npm run lighthouse` | performance 0.87 · a11y 1.00 · best-practices 1.00 · SEO 1.00 |
| Load | k6 | `./ops/load/run.sh` | 98 requests/s, p95 600 ms (was 31 and 2,121) |
| Image security, secrets, SBOM | Trivy, gitleaks | `./ops/security-scan.sh all` | clean |

## Coverage means "the line was executed", not "the error was noticed"

A test that executes a line but checks nothing yields 100% coverage and zero value. That is why next to coverage there is **mutation
testing**: Stryker makes small changes to the code ("mutants": flip a condition, replace a constant, remove a call) and runs the tests.
A mutant that no test noticed is a place where a real bug would go unnoticed.

The mutation score by file (we mutate only the logic where a mistake is expensive: security, data, events):

| File | Score | Note |
|---|---:|---|
| `common/pagination/cursor.ts` | 92.9% | |
| `modules/auth/auth.service.ts` | 89.5% | lockout, password reset |
| `common/casl/app-ability.ts` | 88.6% | the permission map |
| `modules/auth/user-tokens.service.ts` | 81.5% | one-time tokens |
| `common/events/domain-events.service.ts` | 77.6% | outbox |
| `modules/tasks/tasks.service.ts` | 75.2% | was 60.4% |
| `modules/users/users.service.ts` | 75.0% | was 64.2% |

**What Stryker found (real holes, not invented ones):**

- The lockout test compared the lock duration with **the same constant** (`LOCK_MS`): changing 15 minutes to 15 seconds would not have failed any test.
  Now the test checks the literal "15 minutes after 5 failures".
- The "the response does not contain a password" test compared `select` with itself (`toBe(userSelect)`): removing a field from the selection would have gone unnoticed.
  Now the list of fields is written out explicitly.
- The logic of "what exactly changed in a task" (names, status, tags, assignees) had a single test for everything; half of the conditions were not checked. Tests were added
  for each condition separately, including "a different tag order is not a change".
- It was not verified that the task list filters work individually, that the count is taken from the same condition as the page, that relevance pagination
  cuts out the right ids.

The `thresholds.break = 70` in `stryker.config.mjs`: the run fails if the score is lower. It is a **ratchet**: raise it as the score grows.
In CI, Stryker runs weekly and on demand (`mutation.yml`), because it takes several minutes.

**Why not 100%:** a large share of the surviving mutants are literals in `select` (`id: true` → `false`) and message texts. They are caught by
e2e tests with a real DB, while Stryker sees only unit tests. Chasing 100% here would mean writing tests that duplicate the implementation.

## Coverage thresholds are ratchets

Backend: globally 63/72/58/63% (lines/branches/functions/…), for `*.service.ts` — 70%. Frontend: 88/80/85/88%. The values are set slightly
below the measured ones, so that a change that destroys tests fails in CI but small fluctuations do not. The backend is lower because controllers and modules are covered
by e2e tests, which the coverage report does not see.

## End-to-end scenarios that unit tests cannot replace

- **Live updates** (`e2e/realtime.spec.ts`): two real browsers; one person changes data through the API, and on the other's screen it appears
  **without a reload** (event → outbox → Socket.IO → proxy → browser → cache → screen). A second test proves that a person without access
  hears nothing. Unit tests replace the socket, so nothing else verifies this path.
- **File upload** (`e2e/project-image.spec.ts`): a real file pick, saving to S3, display after a reload, rejection of a
  non-image. The test is skipped (not failed) if the stack has no storage.
- Limitation: registration and sign-in have a 5/min limit, so the tests create three people **once per worker** and enter the browser through the
  refresh cookie, not through the form (`e2e/fixtures.ts`).

## Visual regressions

12 snapshots of public pages (sign-in, registration, password reset) in the light and dark themes on desktop and phone screens. Snapshots depend on
fonts and the OS, so they are created and compared **only in the official Playwright Linux container** (`./ops/visual.sh`); CI runs the same command.
A deliberate redesign: `./ops/visual.sh update` and commit the snapshot change.

## Lighthouse: what the measurement showed

A mobile profile with simulated slow network and a slow CPU. Budgets are in `frontend/lighthouserc.json`: performance ≥ 0.80, a11y ≥ 0.95,
best-practices ≥ 0.90, **LCP ≤ 4.2 s**, CLS ≤ 0.1, TBT ≤ 300 ms, scripts ≤ 500 KB.

Measured on the sign-in page: performance 0.87, LCP 3.8 s, FCP 1.7 s, TBT 120 ms, CLS 0.

**Honestly:** an LCP of 3.8 s is a weak spot. The LCP element is the `h1` heading, which appears only after JS is downloaded and executed (~245 KB gzip on
the critical path: the core 118 KB + a shared chunk with forms 64 KB + a chunk with i18n dictionaries and icons 63 KB) and the lazy route chunk. The 4.2 s budget
is set **above the current value** to pin the level and catch regressions. Candidates for improvement (not done):
lazy-loading the dictionary of a language the user did not choose; font `preload`; not wrapping the `h1` in an entrance animation.

## Husky and hooks

`pre-commit` (ESLint + Prettier only for changed files), `commit-msg` (Conventional Commits), `pre-push` (types). This is the first line of defense: a style
or message-format error does not reach CI. The setup is the root `package.json` (its only role is the hooks), `lint-staged.config.mjs` in each package,
and the `.husky/` directory.
