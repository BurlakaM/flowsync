# FlowSync — план архітектурного переходу

> Живий документ. Створено 2026-11-16 за результатами аналізу open-source проєктів на NestJS і React
> (Docmost, Novu, AFFiNE, Teable, Immich, Postiz, Twenty, Vendure, brocoders/nestjs-boilerplate, bulletproof-react).
> Виконані пункти позначаємо `[x]`, а підсумок кожного кроку додаємо в «Журнал прогресу» внизу.
> Правила написання коду — у `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`.

## 1. Мета й принципи

**Мета:** перетворити пет-проєкт на підтримуване застосунок із сучасною архітектурою, безпечним API та
типізованим фронтендом, не втративши працездатності на жодному кроці.

Принципи:

1. **Спершу безпека, потім краса.** Критичні діри закриваємо до будь-якого рефакторингу (фаза 0).
2. **Маленькі кроки.** Одна фаза — одна гілка `refactor/phase-N-<назва>`; після кожного пункту проєкт збирається й запускається.
3. **Не ускладнювати.** Беремо практики з великих проєктів, але лише ті, що окупаються на нашому масштабі
   (без CQRS, hexagonal, GraphQL, Nx).
4. **Автоматична перевірка.** Усе, що можна перевірити машиною (lint, типи, тести, CI), не перевіряємо очима.
5. **Рішення записані.** Кожен вибір бібліотеки чи підходу фіксується в розділі 3.

## 2. Поточний стан (baseline на 2026-11-16)

Що вже добре: модульна структура Nest за фічами, Prisma + PostgreSQL 16, DTO з `class-validator`, Docker-стек
(backend + frontend + db з healthcheck) працює, є CI зі збіркою образів, seed ролей.

Проблеми (їх і виправляє план):

| # | Проблема | Де | Фаза |
|---|---|---|---|
| B1 | `GET /api/users/:email` без авторизації віддає запис користувача разом із хешем пароля | `backend/src/users/users.controller.ts:15` | 0 |
| B2 | `POST /api/users` повертає хеш пароля у відповіді | `backend/src/users/users.service.ts:14` | 0 |
| B3 | Клієнт сам обирає `role_id` при реєстрації (можна зареєструватися адміном) | `user.dto.ts`, `users.service.ts:13` | 0 |
| B4 | `POST /tasks` і `POST /comments` без `JwtAuthGuard`; `user_id` береться з тіла запиту | `tasks.controller.ts:16`, `comments.controller.ts:10` | 0 |
| B5 | Створення задачі не перевіряє доступ до `project_id` (можна писати в чужий проєкт) | `tasks.service.ts:17` | 0 |
| B6 | Немає глобального `ValidationPipe`: `POST /users`, `POST /auth/login` не валідуються; у `main.ts` `enableCors()` для всіх origin | `main.ts` | 0 |
| B7 | Два конкуруючі механізми JWT: кастомний `canActivate` кладе в `request.user` payload (`sub`), а `JwtStrategy.validate` повертає `{userId, username}` і ніколи не використовується | `conception/jwt.auth.guard.ts`, `auth/jwt.strategy.ts` | 0 |
| B8 | Немає валідації env; `SECRET_KEY` може бути `undefined`; паролі БД захардкоджені в compose | `app.module.ts`, `docker-compose.yml` | 1–2 |
| B9 | `prisma db push` при старті контейнера замість міграцій | `docker-compose.yml` | 3 |
| B10 | Схема БД: помилка `creared_at`, моделі в `snake_case`, дубль зв'язку task↔tag (`tags` і `task_tags`), немає `updatedAt`, немає індексів на FK, обов'язкові `description`/`image` | `schema.prisma` | 3 |
| B11 | `strictNullChecks` і `noImplicitAny` вимкнені, `any` у сервісах | `tsconfig.json` | 2, 4 |
| B12 | Nest 10 (актуальна гілка вже 12); Node 20 досяг end-of-life у квітні 2026 | `package.json`, Dockerfile | 1–2 |
| B13 | Два lock-файли в backend (`yarn.lock` і `package-lock.json`) | `backend/` | 1 |
| F1 | Фронтенд на Create React App (закритий проєкт) і чистому JS; логіка fetch прямо в компонентах | `frontend/src/**` | 5 |
| F2 | Зайві залежності: `jquery`, `react-bootstrap` + `react-bootstrap-v5`, `react-helmet` | `frontend/package.json` | 5 |
| F3 | `ProtectedRoute` на кожен вхід викликає `POST /auth/validate-token`; токен у `localStorage` | `ProtectedRoute.js` | 6–7 |
| F4 | `Dashboard` — заглушка, функціоналу задач/проєктів у UI немає | `cabinet/Dashboard.js` | 6 |
| I1 | nginx без SPA-fallback: оновлення сторінки `/dashboard` у контейнері дає 404; API-URL вшивається при збірці з `frontend/.env` | `frontend/Dockerfile` | 1 |
| I2 | README описує Vite, папки `back/front` та `docker-compose.override.yml`, яких немає | `README.md` | 1 |
| I3 | CI пушить образи на кожен push у `main` без lint/тестів; `actions/checkout@v3` | `.github/workflows/ci-cd.yml` | 1 |
| I4 | Назви пакетів `jira` (backend) і `my-app` (frontend), БД називається `jira` | `package.json`, compose | 1 |

## 3. Журнал рішень

Статус `прийнято` = дефолт, який використовують AI-агенти. Змінити рішення можна, оновивши рядок тут
і відповідні правила в `AGENTS.md`.

| # | Тема | Рішення | Альтернативи та чому ні |
|---|---|---|---|
| D1 | Шари backend | Controller → Service → Prisma. Окремий `*.repository.ts` лише коли запит складний або повторюється | Hexagonal (brocoders), use-case класи (Novu): забагато файлів для CRUD |
| D2 | БД та міграції | PostgreSQL 16 + Prisma, міграції через `prisma migrate` | `db push` лише для швидких експериментів |
| D3 | Ролі | `enum Role { USER ADMIN }` у моделі `User` замість таблиці `role` | Таблиця ролей виправдана лише з динамічними правами; seed ролей тоді стає непотрібним |
| D4 | Стиль API | REST + OpenAPI (Swagger), camelCase у JSON | GraphQL: один веб-клієнт, прості сутності |
| D5 | Валідація | `class-validator` у DTO + глобальний `ValidationPipe`; env через `zod` | `nestjs-zod`: зайва міграція DTO |
| D6 | Авторизація запитів | Passport JWT; глобальний guard «закрито за замовчуванням» + `@Public()`; ролі через `@Roles()` | Окремі guard-и на кожному маршруті забувають додати (див. B4) |
| D7 | Доступ до ресурсів | Перевірка членства в проєкті в сервісах; для чужого ресурсу повертаємо 404 | CASL — лише якщо правил стане багато |
| D8 | Збірка фронтенду | Vite + React 19 + TypeScript (strict) | CRA закритий; Next.js не потрібен для дашборда за логіном |
| D9 | Роутинг | `react-router` v7 (library mode, lazy-маршрути) | TanStack Router: теж добрий, але менше прикладів у проєктах із цього огляду |
| D10 | Стан | Серверний стан — TanStack Query v5; клієнтський — `useState`/Context, `zustand` лише для справді глобального | Redux/Recoil: зайве |
| D11 | UI | Tailwind CSS 4 + shadcn/ui (Radix) | Mantine (як у Docmost): швидший старт, але менше контролю; Bootstrap видаляємо |
| D12 | Форми | `react-hook-form` + `zod` | Formik: застарів |
| D13 | Структура фронтенду | Feature-папки за bulletproof-react; заборона імпортів між фічами (ESLint) | Плоска структура CRA |
| D14 | Контракт front↔back | OpenAPI → згенерований TS-клієнт (`openapi-typescript`), фаза 7 | Спільний пакет типів: потребує монорепо-інструментів |
| D15 | Репозиторій | Два незалежні пакети, лише `npm`, без Nx/Turborepo | Монорепо-інструменти окупаються з 3+ пакетами |
| D16 | Тести | Backend: Jest + supertest; frontend: Vitest + Testing Library + MSW; e2e: Playwright | — |
| D17 | CI | PR-перевірки (lint, типи, тести, збірка) → деплой лише з `main` після успіху; теги образів `:<sha>` і `:latest` | — |
| D18 | Compose | `docker-compose.yml` (прод) + `docker-compose.override.yml` (dev, hot-reload); секрети в `.env`, не в репозиторії | — |
| D19 | Runtime | Node 24 LTS (або 22, якщо залежність не підтримує 24) | Node 20 — EOL |

## 4. Цільова архітектура

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

Модулі спілкуються лише через експортовані сервіси; циклічні залежності (`forwardRef`) заборонені.

### Frontend

```
frontend/src/
├─ app/         main.tsx, app.tsx, provider.tsx, router.tsx, routes/ (lazy-сторінки)
├─ assets/
├─ components/  ui/ (shadcn), layouts/, errors/
├─ config/      env.ts (zod-парсинг import.meta.env)
├─ features/    auth/, projects/, tasks/, comments/   (кожна: api/, components/, hooks/, types/, index.ts)
├─ hooks/       спільні хуки
├─ lib/         api-client.ts, query-client.ts, auth-storage.ts, utils.ts
├─ testing/     setup.ts, test-utils.tsx, mocks/ (MSW)
└─ types/
```

Напрямок імпортів: `shared (components, hooks, lib, config, types)` → `features` → `app`.
Фічі не імпортують одна одну: їх складають разом у `app/routes`.

## 5. Фази

Розмір: **S** — до пів дня, **M** — 1–2 дні, **L** — 3+ дні. Фази 0→1 виконуємо строго по черзі,
далі backend (2–4) і frontend (5–6) можна вести паралельно, якщо контракт `/auth/login` та
`/auth/validate-token` лишається стабільним до фази 6.

### Фаза 0 — Критичні виправлення безпеки (backend) · розмір M

Гілка `refactor/phase-0-security`. Закриває B1–B7. **Статус: виконано 2026-11-16** (не закомічено).

- [x] 0.1 Написати e2e-тести (supertest) на бажану поведінку: реєстрація, логін, `GET /tasks` без токена → 401, створення задачі в чужому проєкті → 404, відповіді не містять `password` (до фази 2.8 тести йдуть на dev-БД у Docker з унікальними email і прибиранням створених даних)
- [x] 0.2 Прибрати `password` з усіх відповідей (`select` у сервісі користувачів)
- [x] 0.3 Реєстрація не приймає `role_id` (400 через `forbidNonWhitelisted`): завжди роль `user`
- [x] 0.4 Видалити публічний `GET /users/:email`; додати захищений `GET /users/me`
- [x] 0.5 `JwtAuthGuard` на `POST /tasks`, `POST /comments`; `user_id` з токена; прибрати `user_id` з `TasksDto`/`CommentsDto`
- [x] 0.6 У `createTask` перевіряти, що користувач — власник проєкту; для чужого → `NotFoundException`. Так само для коментарів: коментувати можна лише задачу, яку бачиш (створив, призначена тобі або з твого проєкту)
- [x] 0.7 Глобальний `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` у `main.ts`; прибрати локальні `@UsePipes`
- [x] 0.8 Один механізм JWT: `AuthGuard('jwt')` + `JwtStrategy.validate` повертає `{ id, email }`; видалити кастомний `canActivate`; замінити `user.sub` на `user.id`
- [x] 0.9 CORS лише для origin із конфігурації (`CORS_ORIGINS`, за замовчуванням локальні фронтенди); застосунок не стартує без `SECRET_KEY`. Перевірено на Docker-образі без `.env`. Локально Prisma сама підвантажує `backend/.env` у `process.env`, тому автотест цієї вимоги не має сенсу, а повноцінна валідація env — завдання 2.3

**Готово, коли:** усі e2e з 0.1 зелені; `curl /api/users/x@y.z` → 404/401; реєстрація з `role_id` → 400, а без нього створює роль `user`;
`POST /api/tasks` без токена → 401.

### Фаза 1 — Репозиторій, інфраструктура, CI · розмір M

Гілка `refactor/phase-1-infra`. Закриває B8, B12 (частково), B13, I1–I4.

- [ ] 1.1 Лише npm: видалити `backend/yarn.lock`; перейменувати пакети на `flowsync-backend` / `flowsync-frontend`
- [ ] 1.2 Node 24 LTS (або 22) у Dockerfile, CI та `.nvmrc`; `engines` у `package.json`
- [ ] 1.3 `.env.example` у корені, `backend/`, `frontend/`; секрети compose — через `${POSTGRES_PASSWORD}` з кореневого `.env`; БД перейменувати з `jira` на `flowsync`
- [ ] 1.4 Compose: `docker-compose.yml` (прод) + `docker-compose.override.yml` (dev: bind mounts, `nest start --watch`, dev-сервер фронтенду); `Dockerfile` з цілями `dev`/`build`/`prod`; прибрати суфікс `_prod` з імен контейнерів
- [ ] 1.5 `frontend/nginx.conf`: SPA-fallback `try_files $uri /index.html` і проксі `/api/` → `backend:3000`; frontend звертається до `/api` (same-origin, без CORS)
- [ ] 1.6 Docker: запуск від непривілегійованого користувача; healthcheck backend (після фази 2 — `/api/health`)
- [ ] 1.7 ESLint 9 (flat config) + Prettier в обох пакетах; скрипти `lint`, `format:check`
- [ ] 1.8 CI `ci.yml` (PR і push): backend — install, lint, typecheck, test, build, `prisma validate`; frontend — lint, test, build; `docker build` обох образів. Окремий `deploy.yml` лише для `main` після успіху CI; теги `:<sha>` + `:latest`; `actions/*@v4`; кеш Buildx
- [ ] 1.9 Dependabot (npm, docker, github-actions)
- [ ] 1.10 Husky + lint-staged (pre-commit: prettier + eslint для змінених файлів) — необов'язково
- [ ] 1.11 Оновити `README.md`: реальні папки, команди, порти (`5433` для Postgres), змінні середовища

**Готово, коли:** `docker compose up --build` запускає прод-подібний стек; `docker compose up` з override дає hot-reload;
оновлення `/dashboard` у браузері не дає 404; CI зелений на PR.

### Фаза 2 — Фундамент backend · розмір L

Гілка `refactor/phase-2-backend-foundation`. Закриває B8, B11 (частково), B12.

- [ ] 2.1 Оновити Nest послідовно по одній major-версії (10 → 11 → 12) за офіційними migration guide; Prisma — до актуальної 6.x (мінімум 6.2 заради `omit`); перехід на Prisma 7 — окремим кроком за їхнім гайдом. Після кожного кроку: тести зелені
- [ ] 2.2 Реструктуризація каталогів: `conception/` → `common/*`; `prisma.service.ts` → `database/` (глобальний `PrismaModule`); фічі → `modules/*`; видалити власний `ParseIntPipe` на користь вбудованого
- [ ] 2.3 `config/`: zod-схема env (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `PORT`, `NODE_ENV`); застосунок падає на старті при помилці; типізований `AppConfigService`; `SECRET_KEY` → `JWT_SECRET` (оновити `.env.example` і compose)
- [ ] 2.4 `common/`: `@CurrentUser()`, `@Public()`, `@Roles()`, глобальний `JwtAuthGuard` (APP_GUARD) і `RolesGuard`; `AllExceptionsFilter` з єдиним форматом помилок; `PrismaExceptionFilter` (P2002 → 409, P2025 → 404, P2003 → 409); `PaginationQueryDto` і `paginate()`
- [ ] 2.5 Swagger на `/api/docs` (не в production) із Nest CLI plugin
- [ ] 2.6 `helmet`, `@nestjs/throttler` (жорсткіше для `/auth/*`), `enableShutdownHooks()`, `/api/health` (`@nestjs/terminus`), логування через `nestjs-pino` (JSON)
- [ ] 2.7 TypeScript: увімкнути `strictNullChecks`, потім `noImplicitAny`; виправити помилки
- [ ] 2.8 Тестова інфраструктура: окрема БД для e2e (сервіс у compose під profile `test`), helper очищення БД, `jest-mock-extended` для unit-тестів сервісів

**Готово, коли:** застосунок не стартує з некоректним env; `GET /api/health` → 200; Swagger відкривається;
помилки Prisma повертають осмислені коди; `npm run lint && npm test && npm run test:e2e` зелені.

### Фаза 3 — Модель даних і міграції · розмір M

Закриває B9, B10. **Фази 3 і 4 ведемо в одній гілці** `refactor/phase-3-4-domain` (перейменування полів ламає сервіси), але окремими комітами.

- [ ] 3.1 Переписати `schema.prisma`: моделі PascalCase з `@@map("snake_case_plural")`, поля camelCase з `@map`; `createdAt`/`updatedAt`; `enum Role` (D3), `enum TaskStatus` (`TODO`, `IN_PROGRESS`, `DONE`); один неявний m:n між `Task` і `Tag` (видалити `task_tags`); призначення виконавців — `TaskAssignee` із складеним ключем; `ProjectMember` (доступ до проєкту); індекси на всіх FK; політики `onDelete`; `description`/`image` необов'язкові
- [ ] 3.2 `prisma migrate dev --name init`; закомітити `prisma/migrations` (дані тестові, тому міграція даних не потрібна)
- [ ] 3.3 Compose: `prisma migrate deploy` замість `db push` (окремий одноразовий сервіс `migrate` або крок у команді запуску)
- [ ] 3.4 `prisma/seed.ts`: демо-дані (admin, user, проєкт, кілька задач) — ідемпотентно, лише dev

**Готово, коли:** `prisma migrate reset` + seed відпрацьовують на чистій БД; `prisma validate` проходить; CI запускає міграції на тестовій БД.

### Фаза 4 — Модулі backend · розмір L

Порядок: **auth → users → projects → tasks → comments → tags**. У кожному модулі виконати чекліст:
DTO (`Create`/`Update`/`Response`/`Query`), тонкий контролер, сервіс із перевіркою доступу, Swagger-декоратори,
unit-тести сервісу, e2e (401 / 400 / 404 / успіх), видалення старого коду.

- [ ] 4.1 **auth:** `POST /auth/register` (роль завжди `USER`), `POST /auth/login`, `GET /auth/me`; `bcrypt`-cost з конфігурації; троттлінг логіну; `validate-token` лишається як deprecated до фази 6
- [ ] 4.2 **users:** `GET/PATCH /users/me`; адмінський `GET /users` (`@Roles('ADMIN')`)
- [ ] 4.3 **projects:** CRUD; список лише проєктів, де користувач — учасник; власник керує учасниками
- [ ] 4.4 **tasks:** `GET/POST /projects/:projectId/tasks`, `GET/PATCH/DELETE /tasks/:id`; фільтри (статус, виконавець, тег), пагінація, сортування; призначення виконавців
- [ ] 4.5 **comments:** список/створення у задачі; редагування й видалення лише автором
- [ ] 4.6 **tags:** CRUD у межах проєкту
- [ ] 4.7 Увімкнути `strict: true`; поріг покриття сервісів тестами ≥ 70%
- [ ] 4.8 Експортувати `openapi.json` скриптом `npm run openapi:export`

**Готово, коли:** немає жодного ендпоїнта без guard (крім `@Public()`); жодна відповідь не містить `password`; у коді немає `any`; усі e2e зелені.

### Фаза 5 — Фундамент frontend · розмір L

Гілка `refactor/phase-5-frontend-foundation`. Закриває F1, F2.

- [ ] 5.1 Новий проєкт Vite + React 19 + TypeScript (strict) замість CRA; перенести лише `assets/`; видалити `react-scripts`, `jquery`, `react-bootstrap*`, `react-helmet`, `web-vitals`
- [ ] 5.2 Створити структуру з розділу 4, alias `@/`
- [ ] 5.3 Tailwind CSS 4 + shadcn/ui; базові компоненти (Button, Input, Label, Card, Dialog, Form)
- [ ] 5.4 `config/env.ts` (zod над `import.meta.env`), `VITE_API_URL=/api`; dev-proxy Vite `/api` → `http://localhost:3000`
- [ ] 5.5 `lib/api-client.ts` (axios: baseURL, Authorization з `auth-storage`, 401 → вихід), `lib/query-client.ts`
- [ ] 5.6 `app/router.tsx` на `react-router` v7: lazy-маршрути, захищена гілка, error boundary, 404
- [ ] 5.7 ESLint (typescript-eslint, react-hooks, jsx-a11y) + правило `no-restricted-paths` для меж між фічами; Prettier
- [ ] 5.8 Vitest + Testing Library + MSW; `test-utils.tsx` з провайдерами
- [ ] 5.9 Dockerfile (збірка → nginx) і dev-режим у compose

**Готово, коли:** `npm run dev` (і в compose) дає HMR; `npm run build`, `lint`, `test` зелені; сторінка логіну працює через проксі.

### Фаза 6 — Фічі frontend · розмір L

Порядок: **auth → каркас (layout, навігація) → projects → tasks → comments**. Для кожної фічі:
`api/` (функції запитів, query keys, хуки), `components/`, `types/`, тести, нуль імпортів з інших фіч.

- [ ] 6.1 **auth:** `useLogin`, `useRegister`, `useMe` (`GET /auth/me` замість `validate-token`), єдиний модуль `lib/auth-storage.ts`, `ProtectedRoute` на базі `useMe`
- [ ] 6.2 Layout: шапка, навігація, обробка завантаження/помилок/порожнього стану
- [ ] 6.3 **projects:** список, створення, редагування, видалення
- [ ] 6.4 **tasks:** список із фільтрами в URL, створення/редагування (Dialog + форма), зміна статусу, призначення; за бажанням — канбан
- [ ] 6.5 **comments:** потік коментарів у задачі
- [ ] 6.6 Видалити старий код CRA (`Login.js`, `ProtectedRoute.js`, `AuthForm*.js` тощо) і `validate-token` у backend

**Готово, коли:** користувач проходить шлях логін → проєкт → задача → коментар у UI; тести фіч зелені; старих `.js`-файлів немає.

### Фаза 7 — Контракт, якість, безпека · розмір M–L

- [ ] 7.1 Генерація TS-типів із `openapi.json` (`openapi-typescript`); CI перевіряє актуальність згенерованого
- [ ] 7.2 Посилення авторизації: короткий access-токен (15 хв) у пам'яті + refresh-токен в `httpOnly` cookie з ротацією й відкликанням (`RefreshToken` у БД)
- [ ] 7.3 Playwright e2e (логін → проєкт → задача) у CI поверх compose
- [ ] 7.4 Спостережуваність: request id (`nestjs-cls`), структуровані логи, за бажанням Sentry
- [ ] 7.5 Безпека: CSP та заголовки в nginx, `npm audit` у CI, перевірка залежностей Dependabot
- [ ] 7.6 Доступність: `axe` у тестах ключових сторінок

### Фаза 8 — Беклог (за бажанням, без порядку)

WebSocket-синхронізація задач у реальному часі (Nest gateway + socket.io; відповідає назві FlowSync) ·
BullMQ + Redis (сповіщення, email) · завантаження файлів (зображення проєкту, S3-сумісне сховище) ·
повнотекстовий пошук · журнал аудиту · i18n (uk/en) · drag-and-drop канбан (`dnd-kit`) ·
CASL для тонких прав · деплой на VPS (Caddy/Traefik) · use-case класи для складних сценаріїв.

## 6. Definition of Done (для кожного пункту)

1. Код у цільовій структурі й за правилами з `AGENTS.md`.
2. `npm run lint`, типи (`tsc --noEmit`), тести пройдені в змінених пакетах.
3. Нова поведінка покрита тестом (backend: unit сервісу + e2e ендпоїнта; frontend: тест компонента/хука).
4. Docker-стек збирається й запускається (`docker compose up -d --build`), ручна перевірка зміненого сценарію.
5. Прибрано старий код, який замінено; немає закоментованого коду та `console.log`.
6. Відмічено `[x]` у цьому плані; рішення, що змінилися, відображені в журналі рішень.

## 7. Ризики

| Ризик | Мітигація |
|---|---|
| Оновлення Nest/Prisma ламає залежності | По одній major-версії, перед кожною — зелені тести та гілка; перевірка peer-залежностей `@nestjs/*` |
| Перейменування схеми ламає всі сервіси | Фази 3–4 в одній гілці, міграція модуль за модулем; БД містить лише тестові дані |
| Зміна контракту API (snake_case → camelCase) ламає фронтенд | Стабільні `/auth/login` і `/auth/validate-token` до фази 6; решту UI ще не використовує |
| Рефакторинг без тестів | Фаза 0.1 і правило «кожен модуль із e2e» |
| Занадто великий обсяг | Кожну фазу можна зупинити після «Готово, коли»; фаза 8 — лише за бажанням |

## 8. Журнал прогресу

| Дата | Фаза / пункт | Що зроблено | Примітки |
|---|---|---|---|
| 2026-11-16 | Підготовка | Docker на D:, перехід MySQL → PostgreSQL, seed ролей, `.dockerignore`, цей план | Безпекові дірки B1–B7 були відкриті |
| 2026-11-16 | Фаза 0 (0.1–0.9) | Закрито B1–B7: немає `password` у відповідях, роль не приймається, `/users/me` замість `/users/:email`, guard і токен-автор у tasks/comments, перевірка доступу, глобальний `ValidationPipe`, один механізм JWT (`AuthGuard('jwt')`), CORS за списком, `JwtModule.registerAsync`. 20 e2e-тестів зелені (`test/e2e/security.e2e-spec.ts`), живі перевірки в Docker | Додано `src/common/` (`@CurrentUser`, `AuthenticatedUser`) і `src/app.setup.ts`. Видалено зламаний шаблонний `test/app.e2e-spec.ts`. `validate-token` лишається до фази 6 |
