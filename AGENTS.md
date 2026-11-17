# FlowSync — інструкції для AI-агентів

Цей файл читають Claude Code, Codex, Cursor, Copilot та інші агенти. Для людей є `README.md`.
Деталі по частинах: `backend/AGENTS.md`, `frontend/AGENTS.md`. План робіт: `docs/ARCHITECTURE_PLAN.md`.

## Про проєкт

FlowSync — пет-проєкт, трекер задач у стилі Jira: проєкти, задачі, коментарі, теги, виконавці.
Власник свідомо переводить проєкт на нову архітектуру й вчиться на цьому, тому **пояснюй «чому»**, а не лише «що».

## Мова

- Спілкування з власником — **українською**.
- Ідентифікатори, назви гілок, повідомлення комітів, назви тестів — **англійською**.
- Коментарі в коді — англійською й лише коли пояснюють «чому», а не «що».
- Документація (`docs/`, README) — українською.

## Стек

| Шар | Поточний стан | Ціль (після плану) |
|---|---|---|
| Backend | NestJS 12, Prisma 7.10 (адаптер `pg`), JWT (Passport), TypeScript 6 (strict), Vitest, Node 24 LTS | + схема БД і модулі за планом (фази 3–4) |
| БД | PostgreSQL 16, міграції `prisma migrate`, PascalCase-моделі, `enum Role` | те саме |
| Frontend | React 19, Vite 8, TypeScript (strict), Tailwind 4 + shadcn/ui (дизайн «Aurora», світла й темна теми), TanStack Query, react-router 8, Vitest + MSW | те саме; типи генеруються з OpenAPI, e2e на Playwright |
| Інфра | Docker Compose (dev-override + прод), nginx-проксі, Redis (черга), Mailpit і S3-сховище в dev, CI з перевірками | деплой на VPS (фаза 8.9, ще не зроблено) |

Репозиторій складається з двох незалежних npm-пакетів: `backend/` і `frontend/` (без монорепо-інструментів). Лише `npm`.

## Команди

```bash
docker compose up -d --build                         # увесь стек, dev-режим (override, hot reload)
docker compose -f docker-compose.yml up -d --build   # прод-подібний режим (лише :8080, nginx проксіює /api)
docker compose logs -f backend                       # логи
docker compose down                                  # зупинка (дані БД зберігаються; НЕ додавай -v)
```

Адреси в dev-режимі: фронтенд `http://localhost:5173`, API `http://localhost:3000/api`, Postgres `localhost:5433`
(БД `flowsync`, користувач і пароль із кореневого `.env`). У прод-режимі: `http://localhost:8080` (API через `/api`).
Секрети лежать у `.env`, `backend/.env`, `frontend/.env` (не комітяться; приклади — `.env.example`).
Демо-акаунти dev-seed: `admin@flowsync.test` (ADMIN) і `user@flowsync.test`, пароль `password-123` (лише для розробки).

Локально без Docker (БД має працювати в Docker):

```bash
cd backend && npm run start:dev      # API з watch
cd backend && npm test               # unit
cd backend && npm run test:e2e       # e2e (спершу: docker compose --profile test up -d db_test)
cd backend && npm run lint           # ESLint 9; lint:fix виправляє
cd backend && npm run format:check   # Prettier; npm run format форматує
cd backend && npm run typecheck      # tsc --noEmit
cd backend && npx prisma migrate dev --name <verb_noun>   # нова міграція після зміни schema.prisma (БД на :5433)
cd backend && npm run openapi:export  # після зміни API: оновити backend/openapi.json (CI перевіряє)
cd frontend && npm run dev           # Vite з HMR
cd frontend && npm test              # Vitest; також lint, typecheck, build, format:check
cd frontend && npm run api:types     # після зміни API (і openapi.json): оновити src/types/api.generated.ts (CI перевіряє)
./ops/security-scan.sh all          # Trivy (образи), gitleaks (історія git), SBOM; усе в Docker, без акаунтів
./ops/backup.sh && ./ops/restore-verify.sh   # бекап БД і доказ, що його можна відновити (docs/OPERATIONS.md)
cd frontend && npm run test:e2e      # Playwright проти прод-подібного стеку на :8080 (спершу docker compose -f docker-compose.yml up -d --build)
```

## Робочий процес

1. **Прочитай `docs/ARCHITECTURE_PLAN.md`** і визнач поточну фазу (перша фаза з невідміченими пунктами).
   Працюй лише в її межах; не змішуй рефакторинг із новими функціями в одному коміті.
2. **Нову логіку пиши в цільовій структурі** (див. розділ 4 плану), навіть якщо старий код ще не перенесено.
   Старий код переноси лише в рамках відповідної фази; поза фазою чіпай його тільки заради виправлення безпеки або бага.
3. **Малі кроки:** один логічний крок — один коміт. Формат Conventional Commits:
   `feat(tasks): add status filter`, `fix(auth): ...`, `refactor`, `test`, `chore`, `docs`.
4. **Не роби `git commit` / `git push` без прямого прохання власника.** Гілки: `refactor/phase-N-<назва>`, `feat/<назва>`, `fix/<назва>`.
5. **Після завершення пункту** познач `[x]` у плані й додай рядок у «Журнал прогресу».
6. **Нова бібліотека поза журналом рішень** (розділ 3 плану): спершу запропонуй власнику й додай рядок у журнал.
7. **Сумнів чи суперечність** між цими правилами і наявним кодом: не вгадуй, а запитай або запропонуй оновити правило.

## Definition of Done

Зміна завершена, лише коли:

1. Код відповідає правилам з `backend/AGENTS.md` / `frontend/AGENTS.md`.
2. Пройдено lint, типи (`tsc --noEmit`) і тести в змінених пакетах (якщо скрипт уже існує).
3. Нова поведінка покрита тестом.
4. Стек збирається й стартує (`docker compose up -d --build`), змінений сценарій перевірено вручну (curl/браузер).
5. Старий код, який замінено, видалено; немає закоментованого коду й `console.log`.
6. Звіт власнику: що змінено, що перевірено, чого **не** перевірено.

## Безпека (обов'язково завжди)

- Ніколи не повертай у відповідях API `password` чи інші секретні поля.
- Ніколи не довіряй ідентифікатору користувача з тіла запиту, лише з токена.
- Кожен ендпоїнт закритий за замовчуванням (глобальний `JwtAuthGuard`); публічність — лише `@Public()` і коментар причини.
- Усі змінні середовища проходять через zod-схему `backend/src/config/env.schema.ts`; читати лише через `AppConfigService`.
- Усі вхідні дані валідуються DTO; ніяких секретів у коді й комітах; `.env` ніколи не комітиться.
- Перевірка доступу до ресурсу: чужий ресурс → `404`, а не `403`.

## Заборонено без явного дозволу власника

- `docker compose down -v`, `docker volume rm`, `docker system prune`, `prisma migrate reset`, `prisma db push --force-reset`:
  усе, що знищує дані БД.
- Змінювати значення секретів у `.env`, виводити їх у відповідях чи логах.
- `git push --force`, перепис історії, зміна вже закомічених міграцій Prisma.
- Оновлення major-версій залежностей поза планом.
- Видалення файлів поза переліком, що явно випливає із завдання.

## Типові помилки, яких уникати

- Дописувати нову логіку у старі файли замість цільової структури.
- Виправляти симптом (наприклад, `any`, `@ts-ignore`, `eslint-disable`), а не причину.
- Створювати абстракції «про запас» (репозиторії, фабрики, generic-базові класи) без другого використання.
- Тихо глушити помилки (`catch {}`); обробляти помилки лише там, де є що з ними робити.
- Вигадувати API бібліотек: якщо не впевнений у сигнатурі, перевір документацію або встановлену версію в `node_modules`.
