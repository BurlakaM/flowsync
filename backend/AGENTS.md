# Backend (NestJS) — rules

Shared rules: `../AGENTS.md`. The plan and current phase: `../docs/ARCHITECTURE_PLAN.md`.
The structure, DB schema and domain modules below are real (phases 2–4).
Ready modules: auth, users, projects, tasks, comments, tags. The frontend uses all of them; the login response
(the `access_token` field) stays unchanged so as not to break the client.

## Structure

```
src/
├─ main.ts                  bootstrap: pino logger, configureApp, Swagger (not in production)
├─ app.module.ts            modules, global guards (throttler → JWT → roles) and filters
├─ app.setup.ts             the /api prefix, helmet, ValidationPipe, CORS, shutdown hooks, trust proxy
├─ swagger.ts               /api/docs
├─ config/                  env.schema.ts (zod), app-config.service.ts, config.module.ts
├─ database/                prisma.module.ts (global), prisma.service.ts
├─ common/                  decorators/ guards/ filters/ pagination/ types/
├─ health/                  GET /api/health/live and /ready (= /api/health); public, no throttle; Redis only if REDIS_URL is set
├─ metrics/                 GET /api/metrics (Prometheus): MetricsService, a request-duration middleware; the modules register their own gauges
└─ modules/<feature>/
   ├─ dto/                    create-x.dto.ts, update-x.dto.ts, x-response.dto.ts, query-x.dto.ts
   ├─ x.controller.ts
   ├─ x.service.ts
   ├─ x.service.spec.ts       a unit test next to the service
   └─ x.module.ts
prisma/                     schema.prisma, migrations/, seed.ts (demo data, dev only)
test/                       e2e/*.e2e-spec.ts, utils/ (createTestApp, cleanDatabase), setup-env.ts, global-setup.ts
```

## Layers and responsibilities

| Layer | Does | Does not |
|---|---|---|
| Controller | the route, DTOs, `@CurrentUser()`, calling the service, Swagger decorators | business logic, Prisma, access checks |
| Service | business logic, access checks, Prisma queries | knowledge of HTTP (`Request`, `Response`) |
| Repository (optional) | complex/repeated Prisma queries | authorization logic. Create one only when a query is used ≥ 2 times or is too big for a service |

Modules talk only through exported services. Importing another module's files directly is forbidden.
Resolve a dependency cycle by extracting shared code, not with `forwardRef`.
`PrismaService` is global: do not add it to `providers` in modules, just inject it.

## Module template

DTO (`class-validator`; fields with `!` because TS 6 is `strict`; `PartialType` comes from `@nestjs/swagger`):

```ts
export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

Controller: thin, the user id only from `@CurrentUser()`. No guard needs to be attached: JWT is checked globally.

```ts
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(user.id, projectId, dto);
  }
}
```

Service: the access check first, the response through `select` (never return a whole entity):

```ts
export const taskSelect = {
  id: true, name: true, description: true, status: true, createdAt: true,
} satisfies Prisma.TaskSelect;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async create(userId: number, projectId: number, dto: CreateTaskDto) {
    await this.projects.assertMember(userId, projectId); // someone else's project -> NotFoundException
    return this.prisma.task.create({
      data: { ...dto, projectId, createdById: userId },
      select: taskSelect,
    });
  }
}
```

A paginated list (`common/pagination`):

```ts
async list(userId: number, query: PaginationQueryDto) {
  const where = { /* only what is accessible to the user */ };
  const [items, total] = await Promise.all([
    this.prisma.task.findMany({ where, select: taskSelect, ...paginationArgs(query) }),
    this.prisma.task.count({ where }),
  ]);
  return toPage(items, total, query); // { items, meta: { page, limit, total, totalPages } }
}
```

## Rules

**API**
- JSON in camelCase. Return collections with pagination (`PaginationQueryDto`, `paginationArgs`, `toPage`); short reference lists
  (a project's tags) do not need pagination. Constantly growing lists (activity, comments) are read **by cursor**
  (`common/pagination/cursor.ts`: `CursorQueryDto`, `toCursorPage`, the response `{ items, nextCursor }`, no `total`; the cursor is the id of the last row, and there is an index for it).
- Resources are nested only when the parent is needed in the URL: `projects/:projectId/tasks`, `tasks/:taskId/comments`; a single item
  is addressed by its own id (`tasks/:id`). `DELETE` returns `204` with no body.
- Describe responses with `*-response.dto.ts` classes and `@ApiOkResponse({ type })`: Swagger and `openapi.json` are built from them.
  After an API change run `npm run openapi:export` and commit `openapi.json` (CI fails if the file is stale).
- Clean input with `@Trim()` and `@NormalizeEmail()` (`common/decorators/transform.decorators.ts`); unknown body fields give `400`.
- Errors are Nest exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`); do not return `null` instead of 404.
  All errors share one body `{ statusCode, error, message, path, timestamp, requestId }` (`AllExceptionsFilter`).
  `requestId` matches the `X-Request-Id` header and `req.id` in logs: taken from the incoming header (if it looks like an id) or generated as a UUID.
- Editing a task is **optimistic concurrency**: `PATCH /tasks/:id` requires the `version` from the latest response, and the write is a single `update where { id, version }` statement with `version: { increment: 1 }`; a mismatch → `409`, a deleted task → `404`.
- Prisma errors (`P2002` → 409, `P2025` → 404, `P2003` → 409) are mapped by `PrismaExceptionFilter`; do not catch them in services without need.
- Swagger: the Nest CLI plugin describes DTOs automatically (`*.dto.ts` files); add `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation` by hand.

**Authentication and access**
- All routes are closed by the global `JwtAuthGuard`. Only `@Public()` plus a reason comment makes a route public
  (currently: registration, login, `refresh`, `logout`, health).
- Role restriction is `@Roles(Role.Admin)` (checked by the global `RolesGuard`).
- The user in a request is `AuthenticatedUser { id; email; role }`, obtained through `@CurrentUser()`. No `req.user.sub`.
  `JwtStrategy` reads the user from the DB on every request, so a deleted user's token is invalid immediately.
- Account security (`AuthService`, `UsersService`, `UserTokensService`): 5 wrong passwords in a row lock the account for 15 min (`429`, even for the correct password; an unknown email is always `401` with a bcrypt comparison against a dummy hash so the response time does not reveal accounts). Password reset and email verification are one-time tokens from an email (`user_tokens`, only SHA-256 in the DB), with the token in the link's `#fragment`; `forgot-password` is always `204` and at most one email per minute. A password change and a reset **in one transaction** update `passwordChangedAt`, revoke all refresh tokens and lift the lockout; `JwtStrategy` rejects access tokens issued before `passwordChangedAt`. Notification emails go only to verified addresses (`emailVerifiedAt`). Tests register users with `api.signUp(name)` (it verifies the address), and unverified ones with `signUp(name, { verified: false })`.
- Session: the access JWT lives 15 min; the refresh token is 48 random bytes in the `httpOnly` cookie `refresh_token` (`SameSite=Strict`, `Path=/api/auth`),
  with only a SHA-256 hash in the DB (`RefreshToken`). Each refresh token works once (rotation); reusing an already spent token
  (outside the 10 s window for two tabs) revokes the whole token family. The logic is `RefreshTokensService`, the HTTP part (cookie) is only in `AuthController`.
  `COOKIE_SECURE=true` (HTTPS) enables the `Secure` cookie.
- Registration always creates the `USER` role (the schema default); a role in the request body is forbidden (400).
  A role is Prisma's `enum Role` (`USER`, `ADMIN`), imported from `common/types/role.type.ts`.
- Access to a resource is checked by the service (project membership), not the controller; someone else's resource → `NotFoundException`.
  A member without the needed right (changing the project, deleting someone else's task or comment) → `ForbiddenException`.
  "Who can see a project" is described only in `ProjectsService` (`accessFilter`, `assertAccess`, `assertOwner`): other modules take it from there
  rather than duplicating conditions. The ADMIN role does not grant access to other people's projects.
- Rate limiting: globally 100 requests/min per IP, `@Throttle` 5/min for login and registration. Disabled when `NODE_ENV=test`.

**Events, permissions, mail, files**
- Data changes publish domain events through a **transactional outbox**: `DomainEventsService.transact(async (tx, emit) => { …write via tx…; emit({...}); return result; })`. The write and the event land in one transaction, so "saved, but the event lost" is impossible; right after the commit the event is delivered, and whatever was not delivered (a subscriber failure, a process crash) is picked up by `OutboxRelayService` (`FOR UPDATE SKIP LOCKED`, a 30 s lease, 2^n s backoff, status `DEAD` after 8 attempts). Inside `transact` write only through `tx`, not `this.prisma`; keep reads and access checks before it.
- Delivery is **at least once**: a subscriber (`@OnEvent(DOMAIN_EVENT)`, receives a `DeliveredDomainEvent` with `id`) must be idempotent and **must not swallow errors**, otherwise the outbox will not retry. Audit: a unique `eventId` + `skipDuplicates`; notifications: a unique `(eventId, userId)`; real-time is safe by nature. Subscribers: the audit log (`modules/activity`), notifications (`modules/notifications`), real-time (`modules/realtime`). A subscriber must be fast (slow work goes to a queue).
- Events contain only small facts (names, changes, ids): not entities and not secrets. The project's log is cleaned up together with the project.
- "Who can do what in a project" permissions live only in `common/casl/app-ability.ts`; services call `authorize(userId, project, action, subject, message)` (403). Access (404) stays in `ProjectsService.assertAccess`. When you change a rule, change it there and in `app-ability.spec.ts`.
- Mail: only through `MailQueueService.enqueue` (never throws). Without `SMTP_HOST`+`MAIL_FROM` nothing is sent; with `REDIS_URL` emails go through BullMQ with retries, without it — immediately. The transport is replaced via the `MAIL_TRANSPORT` token (in e2e: `createTestApp({ mailTransport })`).
- Files: only through `StorageService` (`common/storage`), the `OBJECT_STORE` token; in e2e `createTestApp({ objectStore })`. The image type is detected from bytes (`detectImageType`), SVG is not accepted. The object key is never given to the client.
- Task search is `TasksSearchService` (full-text, `to_tsquery('simple', …)` with prefixes); the expression in the `tasks_fts_idx` index must match the expression in the query.
- Real-time: with `REDIS_URL`, Socket.IO works through `RedisIoAdapter` (main.ts), so several API instances act as one server; without Redis — one instance. The path is `/api/socket.io`; rooms are `project:<id>` and `user:<id>`; access is checked on connect and updated by the `member.added/removed`, `project.created/deleted` events.

**Observability**
- Metrics: `MetricsService` (global). A new data metric is `registerGauge` in the owning module (the value is read at scrape); labels only from a bounded set (never ids or URLs).
- `config/instrument.ts` must remain the **first import** of `main.ts`: instrumentation patches modules at load time.
- `5xx` errors reach Sentry through `AllExceptionsFilter`; we do not send `4xx`.

**Configuration**
- All environment variables are described in `config/env.schema.ts` (zod). A new variable = a row in the schema + `.env.example` + README.
- Read values only through `AppConfigService`; `process.env` outside `config/` and `test/` is forbidden.
  The only exception is `config/instrument.ts` (OpenTelemetry and Sentry): it runs before the Nest container is created and reads `OTEL_*`/`SENTRY_DSN` directly.
- The app does not start with an invalid env. In production `JWT_SECRET` must be ≥ 32 characters.

**Data**
- Prisma only in services/repositories, never in controllers. Raw SQL only with a justification in a comment.
- Prisma 7: the client works through the `pg` driver (`PrismaPg` in `PrismaService` and `prisma/seed.ts`), the CLI config (the schema path, migrations, seed, `DATABASE_URL`) is in `prisma.config.ts`, not in `package.json` or `schema.prisma`. `prisma generate` requires the `DATABASE_URL` variable (a placeholder is supplied in the Dockerfile). The filter reads a uniqueness error (`P2002`) from the index name (`users_email_key`).
- The schema changes through `npx prisma migrate dev --name <verb_noun>` (in a non-interactive terminal: `migrate diff --from-config-datasource --to-schema … --script` into a new migration folder and `migrate deploy`); **do not edit an already committed migration**.
  A new migration is committed together with the `schema.prisma` changes; CI fails if the schema drifted from the migrations. We do not use `prisma db push`.
  `prisma migrate reset` only on a dev database and only with the owner's permission.
- Checking destructive migrations (drop, a rename with data) — only with the owner's permission.
- Several writes that must be atomic — `prisma.$transaction`.
- For lists, do not allow N+1: `include`/`select` in one query.
- **Do not use `_count: { select: { … } }` in lists and selections that go onto a page**: Prisma translates it as a `GROUP BY` over the WHOLE
  child table (independent of page size; on 180,000 comments that is 45 ms per request). Count separately for the ids on the page:
  `groupBy` with `where: { id: { in } }` (examples: `TasksService.withCommentCounts`, `ProjectsService.taskCounts`). Before considering a query
  fast, look at `EXPLAIN (ANALYZE)` on data of realistic size (`ops/load/seed.sql`), not on three rows: `docs/PERFORMANCE.md`.
- Full-text search (`TasksSearchService.rankedIds`) accepts the **list of accessible projects** (`ProjectsService.accessibleIds`) and is split into `UNION`
  branches (each with its own GIN index); an `OR EXISTS` condition between a task and a comment disables the index.
- Schema: PascalCase models, camelCase fields, snake_case in the DB (`@@map`/`@map`); every foreign key has an index; `onDelete` is specified explicitly.
  Project access: the owner = `Project.ownerId`, other members are in `ProjectMember`; tasks and comments are kept after the author is deleted (`SetNull`).
- Seed: `prisma/seed.ts` fills only dev with demo data (idempotent, skipped in production), run through `tsx`.
  There is no need to seed roles in the DB: it is an enum.

**Code**
- Files are kebab-case with a role suffix (`tasks.service.ts`, `create-task.dto.ts`); one class per file; classes are PascalCase.
- TypeScript 6 with `strict: true`. No `any` (ESLint warns), the type of an unknown is `unknown` + narrowing. No `@ts-ignore`.
- Logging is `Logger` from `@nestjs/common` (pino under the hood), never `console.log`. Do not write secrets and tokens to logs
  (the `authorization` and `cookie` headers are redacted automatically).
- Passwords — `bcryptjs`, comparison only with `bcrypt.compare`.
- Do not change the global `api` prefix and port 3000 without agreement: nginx and compose are configured for them.
- Nest 12 and Vitest need Node ≥ 22.12 (24 recommended). Nest packages are now ESM: Jest does not work, we use Vitest.

## Tests (Vitest)

- **Unit** (`src/**/*.spec.ts`, `npm test`): every public service method, guards, filters. Prisma is mocked through
  `vitest-mock-extended` (`mockDeep<PrismaService>()`); the globals `describe/it/vi/expect` are available without import.
- **E2E** (`test/e2e/*.e2e-spec.ts`, `npm run test:e2e`): every endpoint — at least 401 without a token, 400 on an invalid body,
  404 on someone else's resource, a success scenario. The app is created by `createTestApp()` (the real `AppModule` + `configureApp`),
  call `cleanDatabase(prisma)` in `beforeAll`. The schema is applied to the test DB by `global-setup` (`prisma migrate deploy`).
- Tests go to a **separate DB** `flowsync_test`: `docker compose --profile test up -d db_test` (port 5434, data in memory).
  `cleanDatabase` and `globalSetup` refuse to work with a DB whose name does not contain `test` (allowed in CI).
  **Never point `TEST_DATABASE_URL` at a working DB.**
- Names: `it('returns 404 when task belongs to another project')` — behavior, not implementation.
- Write e2e scenarios with `createApi(app)` (`test/utils/api.ts`): `signUp`, `signUpAdmin`, `get`/`post`/`patch`/`del`.
  For each resource check the matrix: owner, member, outsider, no token.
- Service unit tests cover the access and validation branches; the service coverage threshold is 70% (`npm run test:cov`, CI checks it too).
- A new security check (guard, access) without a test is not considered done.

## Commands

```bash
npm run start:dev    # API with watch (the host needs a DB on :5433)
npm run lint         # ESLint 9; lint:fix fixes
npm run format       # Prettier (format:check — check only)
npm run typecheck    # tsc --noEmit
npm test             # unit; test:cov — coverage
npm run test:e2e     # e2e (db_test is required)
npm run build        # nest build -> dist/main.js
npm run openapi:export  # builds and writes openapi.json (no DB needed)
```

## New module checklist

1. DTOs (`Create`/`Update`/`Response`/`Query`) with validation.
2. Service: access check → logic → `select`.
3. A controller without logic, with Swagger decorators; public routes only with `@Public()` and a comment.
4. Module: `exports: [XService]` if others use it; add to `AppModule`.
5. A service unit test + endpoint e2e.
6. A Prisma migration (if the schema changed) + an updated seed.
7. New environment variables: the zod schema, `.env.example`, README.
8. The old code is removed; the item is ticked in the plan.
