# FlowSync

Пет-проєкт: трекер задач у стилі Jira (проєкти, задачі, коментарі, теги, виконавці).
Backend на **NestJS**, frontend на **React**, база **PostgreSQL**, усе запускається через **Docker Compose**.
Проєкт поступово переходить на нову архітектуру, план і статус: [docs/ARCHITECTURE_PLAN.md](docs/ARCHITECTURE_PLAN.md).

## Технології

| Шар | Зараз |
|---|---|
| Backend | NestJS 12, Prisma 6.19, Passport JWT, TypeScript 6, Vitest |
| Frontend | React 18 (Create React App, JS) |
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
| Frontend (dev-сервер) | http://localhost:3001 |
| API | http://localhost:3000/api |
| Swagger (лише не в production) | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5433` (користувач і пароль з `.env`, БД `flowsync`) |

Backend і frontend перезбираються автоматично при зміні файлів у `backend/src` та `frontend/src`.
Під час старту контейнера backend виконує `prisma db push` і seed ролей (поки немає міграцій, див. план, фаза 3).

Зупинка: `docker compose down`. **Не додавайте `-v`**: це видалить дані БД.

## Прод-подібний запуск

```bash
docker compose -f docker-compose.yml up -d --build
```

Назовні опубліковано лише frontend: http://localhost:8080. nginx віддає збірку React і проксіює `/api/` на backend,
тому CORS не потрібен. Порти backend і БД на хост не виставляються. Swagger у цьому режимі вимкнений.

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
npm start               # dev-сервер CRA
npm run format:check
npm run build
```

## Змінні середовища

| Файл | Змінна | Призначення |
|---|---|---|
| `.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | БД у Docker і `DATABASE_URL` backend у compose |
| `backend/.env` | `JWT_SECRET` | секрет підпису JWT; у production ≥ 32 символів. Застосунок не стартує без нього |
| `backend/.env` | `DATABASE_URL` | БД для запуску на хості; у compose перекривається |
| `backend/.env` | `JWT_EXPIRES_IN` | необов'язково: час життя токена (`15m`, `1h`, `7d`), типово `1h` |
| `backend/.env` | `CORS_ORIGINS` | необов'язково: дозволені origin через кому |
| `backend/.env` | `LOG_LEVEL`, `PORT` | необов'язково: рівень логів (типово `info`), порт (типово `3000`) |
| `backend/.env` | `TRUST_PROXY` | необов'язково: кількість reverse-proxy перед API (у прод-compose `1`), потрібне для коректного IP у rate limit |
| `backend/.env` | `TEST_DATABASE_URL` | необов'язково: БД для e2e (типово `localhost:5434/flowsync_test`) |
| `frontend/.env` | `REACT_APP_API_URL` | адреса API для dev-сервера; у прод-образі збирається як `/api` |

Файли `.env` не комітяться, у репозиторії лише `.env.example`. Усі змінні backend валідує zod-схема
(`backend/src/config/env.schema.ts`): при помилці застосунок не стартує й показує, що саме не так.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): на кожен PR і push у `main`. Backend: `prisma validate`, Prettier, ESLint, типи, unit та e2e
  (на Postgres у service-контейнері), збірка. Frontend: Prettier, тести, збірка. Потім збірка Docker-образів.
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
