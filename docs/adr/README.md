# Architecture Decision Records

Every significant technical decision of the project is recorded separately: what was decided, what was rejected and why. This is the
project's short memory: when half a year from now someone (or you) asks "why is it like this?", the answer is looked up here, not in a chat or a commit.

- The decision log in `docs/ARCHITECTURE_PLAN.md` (section 3) is a condensed view of the same decisions. Here they are expanded.
- The decisions that shape the system most have **"Consequences"** and **"When to revisit"** sections (marked ◆).
- A new decision: copy the closest file, take the next number, add a row to the index below and to the plan log.
  Accepted decisions are not edited retroactively: if a decision changes, write a new ADR and set the old one's status to "superseded by ADR N".

| # | Topic | |
|---|---|---|
| 1 | [Backend layers](0001-backend-layers.md) |  |
| 2 | [Database and migrations](0002-database-and-migrations.md) |  |
| 3 | [Roles](0003-roles-as-enum.md) |  |
| 4 | [API style](0004-rest-and-openapi.md) |  |
| 5 | [Validation](0005-validation.md) |  |
| 6 | [Request authorization](0006-closed-by-default-auth.md) | ◆ |
| 7 | [Resource access](0007-resource-access-404.md) | ◆ |
| 8 | [Frontend build](0008-vite-react-typescript.md) |  |
| 9 | [Routing](0009-react-router.md) |  |
| 10 | [State](0010-server-state-tanstack-query.md) |  |
| 11 | [UI](0011-tailwind-and-shadcn.md) |  |
| 12 | [Forms](0012-forms.md) |  |
| 13 | [Frontend structure](0013-feature-folders.md) |  |
| 14 | [Front↔back contract](0014-openapi-generated-types.md) |  |
| 15 | [Repository](0015-two-independent-packages.md) |  |
| 16 | [Tests](0016-testing-stack.md) | ◆ |
| 17 | [CI](0017-ci-pipeline.md) |  |
| 18 | [Compose](0018-compose-dev-and-prod.md) |  |
| 19 | [Runtime](0019-node-24-runtime.md) |  |
| 20 | [TypeScript](0020-typescript-6.md) |  |
| 21 | [Logging and API protection](0021-logging-and-api-protection.md) |  |
| 22 | [Access model](0022-project-ownership-model.md) | ◆ |
| 23 | [Migrations](0023-prisma-migrate.md) |  |
| 24 | [Access rights](0024-project-access-rule.md) | ◆ |
| 25 | [API types on the frontend](0025-frontend-api-types.md) |  |
| 26 | [Session](0026-session-and-refresh-tokens.md) | ◆ |
| 27 | [Request id](0027-request-id.md) |  |
| 28 | [E2E and accessibility](0028-e2e-and-accessibility.md) |  |
| 29 | [Events and permissions](0029-domain-events-and-casl.md) | ◆ |
| 30 | [Queue and mail](0030-queue-and-mail.md) | ◆ |
| 31 | [Files](0031-file-storage.md) |  |
| 32 | [Real-time](0032-realtime-socketio.md) | ◆ |
| 33 | [i18n and the board](0033-i18n-and-board.md) |  |
| 34 | [Design system](0034-aurora-design-system.md) |  |
| 35 | [Production operations](0035-production-operations.md) | ◆ |
| 36 | [Observability](0036-observability.md) | ◆ |
| 37 | [Event delivery](0037-transactional-outbox.md) | ◆ |
| 38 | [Concurrent editing](0038-optimistic-concurrency.md) | ◆ |
| 39 | [Pagination of growing lists](0039-cursor-pagination.md) | ◆ |
| 40 | [Real-time across several instances](0040-multi-instance-realtime.md) |  |
| 41 | [Account and sessions](0041-account-security.md) | ◆ |
| 42 | [Security scans](0042-security-scans.md) |  |
| 43 | [Prisma 7](0043-prisma-7.md) | ◆ |
| 44 | [Git hooks](0044-git-hooks.md) |  |
| 45 | [Mutation tests and thresholds](0045-mutation-testing-and-thresholds.md) |  |
| 46 | [Performance measurement](0046-performance-measurement.md) |  |
| 47 | [Versions and changelog](0047-releases-and-changelog.md) |  |
