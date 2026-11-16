# FlowSync

Пет-проєкт: трекер задач у стилі Jira (проєкти, задачі, коментарі, теги, виконавці).
Backend на **NestJS**, frontend на **React**, база **PostgreSQL**, усе запускається через **Docker Compose**.
Проєкт поступово переходить на нову архітектуру, план і статус: [docs/ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md).

## Технології

| Шар | Зараз |
|---|---|
| Backend | NestJS 12, Prisma 6.19, Passport JWT, TypeScript 6, Vitest |
| Frontend | React 19, Vite, TypeScript, Tailwind 4 + shadcn/ui, TanStack Query, Vitest |
| БД | PostgreSQL 16 |
| Runtime | Node.js 24 LTS (`.nvmrc`) |
| Інфраструктура | Docker Compose, nginx, GitHub Actions |

## Структура

```
flowsync/
├─ backend/                  NestJS API (префікс /api)
│  ├─ prisma/                схема Prisma і seed
│  ├─ src/, test/
│  └─ Dockerfile             цілі: dev, build, prod
├─ frontend/                 React SPA
│  ├─ nginx.conf             SPA-fallback і проксі /api → backend
│  └─ Dockerfile             цілі: dev, build, prod
├─ docker-compose.yml        прод-подібний стек
├─ docker-compose.override.yml   режим розробки (підхоплюється автоматично)
├─ docs/ARCHITECTURE_PLAN.md план переходу на нову архітектуру
├─ AGENTS.md                 правила для AI-агентів
└─ .github/                  CI, деплой, Dependabot
```

## Швидкий старт (розробка)

1. Встановіть Docker (Docker Desktop з WSL2 на Windows).
2. Створіть файли оточення з прикладів:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Заповніть `POSTGRES_PASSWORD` у `.env` та `JWT_SECRET` у `backend/.env`. Паролі мають бути URL-безпечними:
   пароль БД підставляється в `DATABASE_URL`. У `backend/.env` пароль у `DATABASE_URL` має збігатися з `POSTGRES_PASSWORD`.

3. Запустіть стек:

   ```bash
   docker compose up -d --build
   ```

| Сервіс | Адреса |
|---|---|
| Frontend (dev-сервер Vite) | http://localhost:5173 (запити `/api` проксіюються на backend) |
| API | http://localhost:3000/api |
| Swagger (лише не в production) | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5433` (користувач і пароль з `.env`, БД `flowsync`) |

Backend і frontend перезбираються автоматично при зміні файлів у `backend/src` та `frontend/src`.
Під час старту контейнера backend застосовує міграції (`prisma migrate deploy`) і наповнює БД демо-даними (seed, лише в dev):
акаунти `admin@flowsync.test` та `user@flowsync.test`, пароль `password-123`, проєкт «Demo project» із кількома задачами.

Зупинка: `docker compose down`. **Не додавайте `-v`**: це видалить дані БД.

## Прод-подібний запуск

```bash
docker compose -f docker-compose.yml up -d --build
```

Назовні опубліковано лише frontend: http://localhost:8080. nginx віддає збірку React і проксіює `/api/` на backend,
тому CORS не потрібен. Порти backend і БД на хост не виставляються. Swagger у цьому режимі вимкнений. Під час старту backend застосовує міграції;
демо-seed тут не запускається.

У production-режимі `JWT_SECRET` має бути **не коротшим за 32 символи**, інакше backend не стартує. Згенерувати:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

## Команди без Docker

БД при цьому має працювати в Docker (`docker compose up -d db`). Потрібен Node 22+ (рекомендовано 24).

```bash
cd backend
npm ci
npm run start:dev       # API з watch
npm run lint            # ESLint 9
npm run format:check    # Prettier
npm run typecheck       # tsc --noEmit
npm test                # unit (Vitest)
npm run test:e2e        # e2e на окремій БД, спершу: docker compose --profile test up -d db_test

cd frontend
npm ci
npm run dev             # Vite з HMR (проксі /api → localhost:3000)
npm run format:check
npm run lint
npm run typecheck
npm test                # Vitest + Testing Library + MSW
npm run build
```

## API

Усі маршрути мають префікс `/api` і потребують `Authorization: Bearer <token>`, крім реєстрації, логіну, `validate-token` та `/health`.
Інтерактивна документація: Swagger на `/api/docs` (лише в dev); повний опис у [backend/openapi.json](backend/openapi.json).

| Ресурс | Ендпоїнти |
|---|---|
| auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| users | `GET`/`PATCH /users/me`, `GET /users` (лише ADMIN: пагінація, `?search=`) |
| projects | `GET`/`POST /projects`, `GET`/`PATCH`/`DELETE /projects/:id`, `GET`/`POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` |
| tasks | `GET /tasks`, `GET`/`POST /projects/:id/tasks`, `GET`/`PATCH`/`DELETE /tasks/:id` |
| comments | `GET`/`POST /tasks/:id/comments`, `PATCH`/`DELETE /comments/:id` |
| tags | `GET`/`POST /projects/:id/tags`, `PATCH`/`DELETE /tags/:id` |

Правила: проєкт бачать його власник і учасники (стороннім він здається неіснуючим, `404`). Учасники створюють і редагують задачі,
коментарі та теги; проєкт, учасників і теги змінює лише власник; задачу видаляє автор або власник; коментар редагує лише автор.
Списки мають пагінацію `?page=&limit=`, задачі ще фільтри `status`, `assigneeId`, `tagId`, `search` і сортування `sortBy`/`order`.
Після зміни API оновіть опис: `cd backend && npm run openapi:export` (CI перевіряє, що `openapi.json` актуальний).

## База даних і міграції

Схема описана в `backend/prisma/schema.prisma` (моделі PascalCase, у БД таблиці й колонки в `snake_case`). Зміни схеми йдуть лише через міграції:

```bash
cd backend
npx prisma migrate dev --name add_task_due_date   # створює й застосовує міграцію (потрібна БД на :5433)
npx prisma migrate deploy                          # застосовує наявні міграції (так стартує Docker)
npx prisma db seed                                 # демо-дані (лише dev, ідемпотентно)
```

Папку `backend/prisma/migrations/` комітимо, **вже закомічені міграції не редагуємо**. CI перевіряє, що `schema.prisma` не розійшлась
з міграціями (без нової міграції збірка впаде). `prisma migrate reset` очищає БД, тому застосовуйте його лише до dev-бази.

## Змінні середовища

| Файл | Змінна | Призначення |
|---|---|---|
| `.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | БД у Docker і `DATABASE_URL` backend у compose |
| `backend/.env` | `JWT_SECRET` | секрет підпису JWT; у production ≥ 32 символів. Застосунок не стартує без нього |
| `backend/.env` | `DATABASE_URL` | БД для запуску на хості; у compose перекривається |
| `backend/.env` | `JWT_EXPIRES_IN` | необов'язково: час життя токена (`15m`, `1h`, `7d`), типово `1h` |
| `backend/.env` | `CORS_ORIGINS` | необов'язково: дозволені origin через кому |
| `backend/.env` | `LOG_LEVEL`, `PORT` | необов'язково: рівень логів (типово `info`), порт (типово `3000`) |
| `backend/.env` | `BCRYPT_ROUNDS` | необов'язково: складність bcrypt (4-15), типово `10` |
| `backend/.env` | `TRUST_PROXY` | необов'язково: кількість reverse-proxy перед API (у прод-compose `1`), потрібне для коректного IP у rate limit |
| `backend/.env` | `TEST_DATABASE_URL` | необов'язково: БД для e2e (типово `localhost:5434/flowsync_test`) |
| `frontend/.env` | `VITE_API_URL` | необов'язково: базова адреса API, типово `/api` (той самий origin; у прод-образі `/api`) |
| `frontend/.env` | `VITE_PROXY_TARGET` | необов'язково: куди Vite-проксі веде `/api` у dev, типово `http://localhost:3000` (у compose `http://backend:3000`) |

Файли `.env` не комітяться, у репозиторії лише `.env.example`. Усі змінні backend валідує zod-схема
(`backend/src/config/env.schema.ts`): при помилці застосунок не стартує й показує, що саме не так.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): на кожен PR і push у `main`. Backend: `prisma validate`, Prettier, ESLint, типи, unit та e2e
  (на Postgres у service-контейнері), перевірка, що `schema.prisma` не розійшлась з міграціями, збірка. Frontend: Prettier, ESLint, типи, тести, збірка. Потім збірка Docker-образів.
- **Deploy** (`.github/workflows/deploy.yml`): після успішного CI на `main` публікує образи в Docker Hub:
  `<DOCKER_USERNAME>/flowsync-back` і `<DOCKER_USERNAME>/flowsync-front` з тегами `:<sha коміту>` та `:latest`.
  Потрібні секрети репозиторію `DOCKER_USERNAME` і `DOCKER_PASSWORD` (токен доступу Docker Hub).
- **Dependabot** щотижня пропонує оновлення npm, Docker і GitHub Actions.

## Внесок

1. Форк, гілка `feat/<назва>` або `fix/<назва>`.
2. Коміти за Conventional Commits (`feat(tasks): ...`), англійською.
3. Перед PR локально пройдіть `lint`, `format:check`, `typecheck` і тести.

## Ліцензія

MIT.
