# Backend (NestJS) — правила

Спільні правила: `../AGENTS.md`. План і поточна фаза: `../docs/ARCHITECTURE_PLAN.md`.
Структура, схема БД і доменні модулі нижче реальні (фази 2–4).
Готові модулі: auth, users, projects, tasks, comments, tags. Frontend використовує їх усі; відповідь логіну
(поле `access_token`) лишається незмінною, щоб не ламати клієнта.

## Структура

```
src/
├─ main.ts                  bootstrap: pino-логер, configureApp, Swagger (не в production)
├─ app.module.ts            модулі, глобальні guard-и (throttler → JWT → ролі) і фільтри
├─ app.setup.ts             префікс /api, helmet, ValidationPipe, CORS, shutdown hooks, trust proxy
├─ swagger.ts               /api/docs
├─ config/                  env.schema.ts (zod), app-config.service.ts, config.module.ts
├─ database/                prisma.module.ts (global), prisma.service.ts
├─ common/                  decorators/ guards/ filters/ pagination/ types/
├─ health/                  GET /api/health/live і /ready (= /api/health); публічні, без throttle; Redis лише якщо задано REDIS_URL
├─ metrics/                 GET /api/metrics (Prometheus): MetricsService, middleware тривалості запитів; gauge-и реєструють самі модулі
└─ modules/<feature>/
   ├─ dto/                    create-x.dto.ts, update-x.dto.ts, x-response.dto.ts, query-x.dto.ts
   ├─ x.controller.ts
   ├─ x.service.ts
   ├─ x.service.spec.ts       unit-тест поруч із сервісом
   └─ x.module.ts
prisma/                     schema.prisma, migrations/, seed.ts (демо-дані, лише dev)
test/                       e2e/*.e2e-spec.ts, utils/ (createTestApp, cleanDatabase), setup-env.ts, global-setup.ts
```

## Шари й відповідальність

| Шар | Робить | Не робить |
|---|---|---|
| Controller | маршрут, DTO, `@CurrentUser()`, виклик сервісу, Swagger-декоратори | бізнес-логіку, Prisma, перевірку доступу |
| Service | бізнес-логіку, перевірку доступу, запити Prisma | знання про HTTP (`Request`, `Response`) |
| Repository (необов'язково) | складні/повторювані запити Prisma | логіку авторизації. Створюй лише коли запит використовується ≥ 2 разів або надто великий для сервісу |

Модулі спілкуються лише через експортовані сервіси. Імпорт файлів іншого модуля напряму заборонений.
Цикл залежностей вирішуй винесенням спільного коду, а не через `forwardRef`.
`PrismaService` глобальний: у модулях його не додають у `providers`, просто інжектять.

## Шаблон модуля

DTO (`class-validator`; поля з `!`, бо в TS 6 діє `strict`; `PartialType` береться з `@nestjs/swagger`):

```ts
export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

Контролер: тонкий, id користувача лише з `@CurrentUser()`. Guard вішати не треба: JWT перевіряється глобально.

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

Сервіс: перевірка доступу першою, відповідь через `select` (ніколи не віддавай сутність цілком):

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
    await this.projects.assertMember(userId, projectId); // чужий проєкт -> NotFoundException
    return this.prisma.task.create({
      data: { ...dto, projectId, createdById: userId },
      select: taskSelect,
    });
  }
}
```

Список із пагінацією (`common/pagination`):

```ts
async list(userId: number, query: PaginationQueryDto) {
  const where = { /* лише доступне користувачеві */ };
  const [items, total] = await Promise.all([
    this.prisma.task.findMany({ where, select: taskSelect, ...paginationArgs(query) }),
    this.prisma.task.count({ where }),
  ]);
  return toPage(items, total, query); // { items, meta: { page, limit, total, totalPages } }
}
```

## Правила

**API**
- JSON у camelCase. Колекції повертай з пагінацією (`PaginationQueryDto`, `paginationArgs`, `toPage`); коротким довідникам
  (теги проєкту) пагінація не потрібна. Списки, що постійно ростуть (активність, коментарі), читаються **за курсором**
  (`common/pagination/cursor.ts`: `CursorQueryDto`, `toCursorPage`, відповідь `{ items, nextCursor }`, без `total`; курсор — id останнього рядка, під нього є індекс).
- Ресурси вкладені лише тоді, коли батько потрібен у URL: `projects/:projectId/tasks`, `tasks/:taskId/comments`; окремий елемент
  адресується власним id (`tasks/:id`). `DELETE` повертає `204` без тіла.
- Відповіді описуй класами `*-response.dto.ts` і `@ApiOkResponse({ type })`: з них будуються Swagger і `openapi.json`.
  Після зміни API виконай `npm run openapi:export` і закоміть `openapi.json` (CI падає, якщо файл застарів).
- Вхід чисти `@Trim()` і `@NormalizeEmail()` (`common/decorators/transform.decorators.ts`); невідомі поля тіла дають `400`.
- Помилки — виключення Nest (`NotFoundException`, `ForbiddenException`, `ConflictException`); не повертай `null` замість 404.
  Усі помилки мають єдине тіло `{ statusCode, error, message, path, timestamp, requestId }` (`AllExceptionsFilter`).
  `requestId` збігається із заголовком `X-Request-Id` і з `req.id` у логах: беруть із вхідного заголовка (якщо він схожий на id) або генерують UUID.
- Редагування задачі — **оптимістична конкурентність**: `PATCH /tasks/:id` вимагає `version` з останньої відповіді, запис іде одним оператором `update where { id, version }` з `version: { increment: 1 }`; розбіжність → `409`, видалена задача → `404`.
- Помилки Prisma (`P2002` → 409, `P2025` → 404, `P2003` → 409) мапить `PrismaExceptionFilter`; у сервісах не лови їх без потреби.
- Swagger: Nest CLI plugin описує DTO автоматично (файли `*.dto.ts`); додавай `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation` вручну.

**Автентифікація й доступ**
- Усі маршрути закриті глобальним `JwtAuthGuard`. Публічним маршрут робить лише `@Public()` і коментар про причину
  (зараз: реєстрація, логін, `refresh`, `logout`, health).
- Обмеження за роллю — `@Roles(Role.Admin)` (перевіряє глобальний `RolesGuard`).
- Користувач у запиті — `AuthenticatedUser { id; email; role }`, дістається через `@CurrentUser()`. Ніяких `req.user.sub`.
  `JwtStrategy` читає користувача з БД на кожен запит, тож токен видаленого користувача одразу недійсний.
- Сесія: access-JWT живе 15 хв; refresh-токен — випадкові 48 байт в `httpOnly` cookie `refresh_token` (`SameSite=Strict`, `Path=/api/auth`),
  у БД лише SHA-256 хеш (`RefreshToken`). Кожен refresh-токен діє один раз (ротація); повторне використання вже витраченого токена
  (поза вікном 10 с для двох вкладок) відкликає всю родину токенів. Логіка — `RefreshTokensService`, HTTP-частина (cookie) — лише в `AuthController`.
  Cookie `Secure` вмикає `COOKIE_SECURE=true` (HTTPS).
- Реєстрація завжди створює роль `USER` (значення за замовчуванням у схемі); роль у тілі запиту заборонена (400).
  Роль — це `enum Role` з Prisma (`USER`, `ADMIN`), імпортується з `common/types/role.type.ts`.
- Доступ до ресурсу перевіряє сервіс (членство в проєкті), а не контролер; чужий ресурс → `NotFoundException`.
  Учасник без потрібного права (змінити проєкт, видалити чужу задачу чи коментар) → `ForbiddenException`.
  «Хто бачить проєкт» описано лише в `ProjectsService` (`accessFilter`, `assertAccess`, `assertOwner`): інші модулі беруть його звідти,
  а не дублюють умови. Роль ADMIN не дає доступу до чужих проєктів.
- Обмеження частоти: глобально 100 запитів/хв з IP, для логіну й реєстрації `@Throttle` 5/хв. У `NODE_ENV=test` вимкнено.

**Події, права, пошта, файли**
- Зміни даних публікують доменні події через **transactional outbox**: `DomainEventsService.transact(async (tx, emit) => { …запис через tx…; emit({...}); return result; })`. Запис і подія лягають в одну транзакцію, тож «збережено, а подію втрачено» неможливе; одразу після коміту подія доставляється, а недоставлене (збій підписника, падіння процесу) підхоплює `OutboxRelayService` (`FOR UPDATE SKIP LOCKED`, lease 30 с, backoff 2^n с, після 8 спроб статус `DEAD`). Всередині `transact` пиши лише через `tx`, не через `this.prisma`; читання й перевірки доступу лишай до нього.
- Доставка **щонайменше один раз**: підписник (`@OnEvent(DOMAIN_EVENT)`, отримує `DeliveredDomainEvent` з `id`) мусить бути ідемпотентним і **не ковтати помилки**, інакше outbox не повторить доставку. Аудит: унікальний `eventId` + `skipDuplicates`; сповіщення: унікальне `(eventId, userId)`; real-time безпечний за природою. Підписники: журнал аудиту (`modules/activity`), сповіщення (`modules/notifications`), real-time (`modules/realtime`). Підписник мусить бути швидким (повільне — у чергу).
- Події містять лише дрібні факти (імена, зміни, id): не сутності й не секрети. Журнал проєкту очищується разом із проєктом.
- Права «хто що може в проєкті» — тільки в `common/casl/app-ability.ts`; сервіси викликають `authorize(userId, project, дія, суб'єкт, повідомлення)` (403). Доступ (404) лишається в `ProjectsService.assertAccess`. Змінюєш правило — зміни там і в `app-ability.spec.ts`.
- Пошта: лише через `MailQueueService.enqueue` (ніколи не кидає). Без `SMTP_HOST`+`MAIL_FROM` нічого не шлеться; з `REDIS_URL` листи йдуть через BullMQ з повторами, без нього — одразу. Транспорт підміняється токеном `MAIL_TRANSPORT` (у e2e: `createTestApp({ mailTransport })`).
- Файли: лише через `StorageService` (`common/storage`), токен `OBJECT_STORE`; у e2e `createTestApp({ objectStore })`. Тип зображення визначається за байтами (`detectImageType`), SVG не приймаємо. Ключ об'єкта ніколи не віддається клієнту.
- Пошук задач — `TasksSearchService` (повнотекстовий, `to_tsquery('simple', …)` з префіксами); вираз в індексі `tasks_fts_idx` має збігатися з виразом у запиті.
- Real-time: з `REDIS_URL` Socket.IO працює через `RedisIoAdapter` (main.ts), тож кілька інстансів API діють як один сервер; без Redis — один інстанс. Шлях `/api/socket.io`; кімнати `project:<id>` і `user:<id>`; доступ перевіряється при підключенні й оновлюється подіями `member.added/removed`, `project.created/deleted`.

**Спостережуваність**
- Метрики: `MetricsService` (глобальний). Нова метрика даних — `registerGauge` у модулі-власнику (значення читається при scrape); мітки лише з обмеженого набору (ніколи id чи URL).
- `config/instrument.ts` має лишатись **першим імпортом** `main.ts`: інструментація патчить модулі в момент завантаження.
- Помилки `5xx` потрапляють у Sentry через `AllExceptionsFilter`; `4xx` не надсилаємо.

**Конфігурація**
- Усі змінні середовища описані в `config/env.schema.ts` (zod). Нова змінна = рядок у схемі + `.env.example` + README.
- Читати значення лише через `AppConfigService`; `process.env` поза `config/` та `test/` заборонений.
  Єдиний виняток — `config/instrument.ts` (OpenTelemetry і Sentry): він виконується до створення контейнера Nest і читає `OTEL_*`/`SENTRY_DSN` напряму.
- Застосунок не стартує при невалідному env. У production `JWT_SECRET` має бути ≥ 32 символів.

**Дані**
- Prisma лише в сервісах/репозиторіях, ніколи в контролерах. Raw SQL — лише з обґрунтуванням у коментарі.
- Схема змінюється через `npx prisma migrate dev --name <verb_noun>`; **вже закомічену міграцію не редагуй**.
  Нову міграцію комітимо разом зі змінами `schema.prisma`; CI падає, якщо схема розійшлась з міграціями. `prisma db push` не використовуємо.
  `prisma migrate reset` лише на dev-базі й лише з дозволу власника.
- Перевірка деструктивних міграцій (drop, rename з даними) — лише з дозволу власника.
- Кілька записів, що мають бути атомарними, — `prisma.$transaction`.
- Для списків не допускай N+1: `include`/`select` у одному запиті.
- Схема: моделі PascalCase, поля camelCase, у БД snake_case (`@@map`/`@map`); кожен зовнішній ключ має індекс; `onDelete` указується явно.
  Доступ до проєкту: власник = `Project.ownerId`, решта учасників у `ProjectMember`; задачі й коментарі зберігаються після видалення автора (`SetNull`).
- Seed: `prisma/seed.ts` наповнює лише dev демо-даними (ідемпотентний, у production пропускається), запускається через `tsx`.
  Ролей у БД сидити не потрібно: це enum.

**Код**
- Файли kebab-case із суфіксом ролі (`tasks.service.ts`, `create-task.dto.ts`); один клас на файл; класи PascalCase.
- TypeScript 6 зі `strict: true`. Без `any` (ESLint попереджає), тип невідомого — `unknown` + звуження. Без `@ts-ignore`.
- Логування — `Logger` з `@nestjs/common` (під капотом pino), ніколи `console.log`. Секрети й токени в лог не пиши
  (заголовки `authorization` і `cookie` редагуються автоматично).
- Паролі — `bcryptjs`, порівняння лише `bcrypt.compare`.
- Не змінюй глобальний префікс `api` і порт 3000 без узгодження: на них налаштовано nginx і compose.
- Nest 12 і Vitest потребують Node ≥ 22.12 (рекомендовано 24). Пакети Nest тепер ESM: Jest не підходить, використовуємо Vitest.

## Тести (Vitest)

- **Unit** (`src/**/*.spec.ts`, `npm test`): кожен публічний метод сервісу, guard-и, фільтри. Prisma мокається через
  `vitest-mock-extended` (`mockDeep<PrismaService>()`); глобали `describe/it/vi/expect` доступні без імпорту.
- **E2E** (`test/e2e/*.e2e-spec.ts`, `npm run test:e2e`): кожен ендпоїнт — мінімум 401 без токена, 400 на некоректне тіло,
  404 на чужий ресурс, успішний сценарій. Застосунок створює `createTestApp()` (справжній `AppModule` + `configureApp`),
  у `beforeAll` викликай `cleanDatabase(prisma)`. Схему до тестової БД застосовує `global-setup` (`prisma migrate deploy`).
- Тести йдуть на **окрему БД** `flowsync_test`: `docker compose --profile test up -d db_test` (порт 5434, дані в пам'яті).
  `cleanDatabase` і `globalSetup` відмовляються працювати з БД, назва якої не містить `test` (у CI дозволено).
  **Ніколи не вказуй `TEST_DATABASE_URL` на робочу БД.**
- Назви: `it('returns 404 when task belongs to another project')` — поведінка, а не реалізація.
- e2e-сценарії пишуться через `createApi(app)` (`test/utils/api.ts`): `signUp`, `signUpAdmin`, `get`/`post`/`patch`/`del`.
  Для кожного ресурсу перевіряй матрицю: власник, учасник, сторонній, без токена.
- Unit-тести сервісів покривають гілки доступу й валідації; поріг покриття сервісів 70% (`npm run test:cov`, його ж перевіряє CI).
- Нова перевірка безпеки (guard, доступ) без тесту не вважається виконаною.

## Команди

```bash
npm run start:dev    # API з watch (на хості потрібна БД на :5433)
npm run lint         # ESLint 9; lint:fix виправляє
npm run format       # Prettier (format:check — лише перевірка)
npm run typecheck    # tsc --noEmit
npm test             # unit; test:cov — покриття
npm run test:e2e     # e2e (потрібен db_test)
npm run build        # nest build -> dist/main.js
npm run openapi:export  # збирає й записує openapi.json (БД не потрібна)
```

## Чекліст нового модуля

1. DTO (`Create`/`Update`/`Response`/`Query`) із валідацією.
2. Сервіс: перевірка доступу → логіка → `select`.
3. Контролер без логіки, з Swagger-декораторами; публічні маршрути лише з `@Public()` і коментарем.
4. Модуль: `exports: [XService]`, якщо його використовують інші; додати в `AppModule`.
5. Unit-тест сервісу + e2e ендпоїнтів.
6. Міграція Prisma (якщо змінювалась схема) + оновлений seed.
7. Нові змінні середовища: схема zod, `.env.example`, README.
8. Видалено старий код; відмічено пункт у плані.
