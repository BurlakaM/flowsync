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
| Mailpit (фальшивий поштовий сервер: усі листи dev-режиму) | http://localhost:8025 |
| Redis (черга) | `localhost:6380` |

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
npm test                # Vitest + Testing Library + MSW + axe (доступність)
npm run api:types       # типи з ../backend/openapi.json (після зміни API; CI перевіряє)
npm run test:e2e        # Playwright: потрібен запущений прод-подібний стек (:8080) і Chrome
npm run build
```

## API

Усі маршрути мають префікс `/api` і потребують `Authorization: Bearer <token>`, крім реєстрації, логіну, `refresh`, `logout` та `/health`.
Інтерактивна документація: Swagger на `/api/docs` (лише в dev); повний опис у [backend/openapi.json](backend/openapi.json).

| Ресурс | Ендпоїнти |
|---|---|
| notifications | `GET /notifications` (`?unread=true`), `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| activity | `GET /projects/:id/activity` |
| зображення проєкту | `PUT`/`DELETE`/`GET /projects/:id/image` (multipart, поле `file`) |
| auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| users | `GET`/`PATCH /users/me`, `GET /users` (лише ADMIN: пагінація, `?search=`) |
| projects | `GET`/`POST /projects`, `GET`/`PATCH`/`DELETE /projects/:id`, `GET`/`POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` |
| tasks | `GET /tasks`, `GET`/`POST /projects/:id/tasks`, `GET`/`PATCH`/`DELETE /tasks/:id` |
| comments | `GET`/`POST /tasks/:id/comments`, `PATCH`/`DELETE /comments/:id` |
| tags | `GET`/`POST /projects/:id/tags`, `PATCH`/`DELETE /tags/:id` |

Сесія: `POST /auth/login` повертає короткий access-токен (15 хв) у тілі, а refresh-токен ставить в `httpOnly` cookie
(`SameSite=Strict`, `Path=/api/auth`). Frontend тримає access-токен лише в пам'яті; після перезавантаження сторінки або на 401
він викликає `POST /auth/refresh`, і сервер видає нову пару (ротація: кожен refresh-токен працює один раз). Повторне використання
вже використаного токена вважається крадіжкою й закриває всю сесію. `POST /auth/logout` відкликає сесію. Кожна відповідь має
заголовок `X-Request-Id` (його ж містять логи й тіло помилки).

Правила: проєкт бачать його власник і учасники (стороннім він здається неіснуючим, `404`). Учасники створюють і редагують задачі,
коментарі та теги; проєкт, учасників і теги змінює лише власник; задачу видаляє автор або власник; коментар редагує лише автор.
Списки мають пагінацію `?page=&limit=`, задачі ще фільтри `status`, `assigneeId`, `tagId`, `search` і сортування `sortBy`/`order`.
Після зміни API оновіть опис: `cd backend && npm run openapi:export` (CI перевіряє, що `openapi.json` актуальний).

## Можливості, що варто знати

- **Дошка.** Сторінка проєкту має перемикач «Список / Дошка». Перетягування картки між колонками змінює статус; кожна картка має й звичайний вибір статусу.
- **Пошук задач.** Повнотекстовий (PostgreSQL): слова з назви, опису й коментарів, збіг за початком слова (`log` знайде `login`), усі слова мають збігатися. Сортування «Найкращий збіг» (`sortBy=relevance`).
- **Права.** Усі правила «хто що може» описані в одному місці: `backend/src/common/casl/app-ability.ts`.
- **Активність і події.** Сервіси публікують доменні події; на них підписані журнал аудиту (`GET /projects/:id/activity`), сповіщення й оновлення в реальному часі.
- **Сповіщення.** Про призначення на задачу, коментарі до своїх задач і додавання до проєкту: у застосунку (дзвінок у шапці) і, якщо налаштовано пошту, листом через чергу.
- **Реальний час.** Socket.IO за адресою `/api/socket.io`, авторизація токеном у handshake; клієнт чує лише проєкти, до яких має доступ, а події лише повідомляють, що саме змінилося (дані клієнт бере через API).
- **Мови.** Інтерфейс англійською й українською (перемикач у шапці, вибір зберігається в браузері). Тексти — ключі-речення в коді, переклад — `frontend/src/i18n/uk.ts`; тест перевіряє, що перекладено все. Повідомлення API лишаються англійськими.
- **Зображення проєкту.** Завантажується через API (тип перевіряється за вмістом, PNG/JPEG/WebP до 2 МБ), зберігається в S3-сумісному сховищі й віддається лише учасникам проєкту.

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
| `backend/.env` | `JWT_EXPIRES_IN` | необов'язково: час життя access-токена (`15m`, `1h`), типово `15m` |
| `backend/.env` | `REFRESH_TOKEN_TTL_DAYS` | необов'язково: час життя сесії (refresh-cookie), 1-90 днів, типово `7` |
| `backend/.env` | `COOKIE_SECURE` | необов'язково: `true`, коли сайт працює через HTTPS (cookie тоді йде лише захищеним каналом); для `http://localhost` лишайте `false` |
| `backend/.env` | `CORS_ORIGINS` | необов'язково: дозволені origin через кому |
| `backend/.env` | `LOG_LEVEL`, `PORT` | необов'язково: рівень логів (типово `info`), порт (типово `3000`) |
| `backend/.env` | `BCRYPT_ROUNDS` | необов'язково: складність bcrypt (4-15), типово `10` |
| `backend/.env` | `TRUST_PROXY` | необов'язково: кількість reverse-proxy перед API (у прод-compose `1`), потрібне для коректного IP у rate limit |
| `backend/.env` | `REDIS_URL` | необов'язково: Redis для черги листів (у compose задано). Без нього листи відправляються в самому процесі API, без повторів |
| `backend/.env` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | необов'язково: пошта. Листи вмикаються, коли задано `SMTP_HOST` і `MAIL_FROM`; без них нічого не відправляється й нічого не падає (сповіщення лишаються в застосунку). Заготовки з поясненнями — у `backend/.env.example` |
| `backend/.env` | `APP_URL` | необов'язково: куди ведуть посилання в листах (типово `http://localhost:5173`) |
| `backend/.env` | `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | необов'язково: сховище файлів (зображення проєктів) у будь-якому S3-сумісному сервісі. Завантаження вмикається, коли задано пару ключів; без неї решта працює, а завантаження відповідає `503`. У dev-compose працює локальне сховище з тестовими ключами |
| `backend/.env` | `METRICS_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `SENTRY_DSN` | необов'язково: спостережуваність (токен для `/api/metrics`, куди слати трейси, Sentry). Без них вимкнено; див. `docs/OPERATIONS.md` |
| `frontend/.env` | `VITE_SENTRY_DSN` | необов'язково: звіти про помилки з браузера (вшивається при збірці; хост треба додати в CSP) |
| `backend/.env` | `TEST_DATABASE_URL` | необов'язково: БД для e2e (типово `localhost:5434/flowsync_test`) |
| `frontend/.env` | `VITE_API_URL` | необов'язково: базова адреса API, типово `/api` (той самий origin; у прод-образі `/api`) |
| `frontend/.env` | `VITE_PROXY_TARGET` | необов'язково: куди Vite-проксі веде `/api` у dev, типово `http://localhost:3000` (у compose `http://backend:3000`) |

Файли `.env` не комітяться, у репозиторії лише `.env.example`. Усі змінні backend валідує zod-схема
(`backend/src/config/env.schema.ts`): при помилці застосунок не стартує й показує, що саме не так.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): на кожен PR і push у `main`. Backend: `prisma validate`, Prettier, ESLint, типи, unit та e2e
  (на Postgres у service-контейнері), перевірка, що `schema.prisma` не розійшлась з міграціями, збірка. Frontend: Prettier, ESLint, перевірка згенерованих типів, типи, тести, збірка. Обидва пакети перевіряються `npm audit`. Окрема джоба `e2e` піднімає прод-подібний стек і проганяє Playwright. Потім збірка Docker-образів.
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
