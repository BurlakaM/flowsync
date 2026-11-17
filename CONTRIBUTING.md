# Як працювати над FlowSync

Цей файл — для людей (і для вас через пів року). Правила для AI-агентів — у `AGENTS.md`; вони узгоджені з цим файлом.
Якщо щось тут суперечить коду, виправте те, що неправильне, і скажіть про це в PR.

## Швидкий старт

Потрібні Docker (Compose v2) і Node ≥ 22.22 (рекомендовано 24, `.nvmrc`).

```bash
cp .env.example .env && cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env   # і заповнити секрети
docker compose up -d --build        # увесь dev-стек: backend, frontend, Postgres, Redis, Mailpit, S3
npm install                         # у корені: лише git-хуки (Husky); застосунок — це backend/ і frontend/ окремо
```

Адреси: застосунок `http://localhost:5173`, API `http://localhost:3000/api`, пошта (Mailpit) `http://localhost:8025`.
Демо-акаунти: `admin@flowsync.test` і `user@flowsync.test`, пароль `password-123` (лише для розробки).

## Структура

Два незалежні npm-пакети без монорепо-інструментів (ADR 15): `backend/` (NestJS) і `frontend/` (React). Корінь має лише `package.json`
для git-хуків. Огляд — `docs/ARCHITECTURE.md`; рішення й чому — `docs/adr/`; правила коду — `backend/AGENTS.md` і `frontend/AGENTS.md`.

## Процес зміни

1. Гілка від `main`: `feat/<назва>`, `fix/<назва>`, `refactor/<назва>`, `docs/<назва>`.
2. Малі кроки: один логічний крок — один коміт. Не змішуйте рефакторинг із новою поведінкою.
3. Пишіть тест разом із кодом (див. «Тести»). Нова перевірка безпеки без тесту не вважається виконаною.
4. Перед PR запустіть те, що запустить CI (нижче). Хуки зроблять частину за вас.
5. PR малий і з поясненням **чому**, а не лише що. Нове рішення, що змінює архітектуру, — це ще й новий ADR.

### Повідомлення комітів: Conventional Commits

Формат `type(scope): subject`. Це не формальність: з повідомлень **автоматично** будуються версії й `CHANGELOG.md` (release-please),
а хук `commit-msg` відхиляє повідомлення, що не відповідають формату.

| type | коли | у версії |
|---|---|---|
| `feat` | нова можливість для користувача | minor |
| `fix` | виправлення помилки | patch |
| `perf` | прискорення без зміни поведінки | patch |
| `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style` | усе інше | без змін версії |
| `feat!`, `fix!` або `BREAKING CHANGE:` у тілі | несумісна зміна API чи поведінки | major (поки `0.x` — minor) |

Приклади: `feat(tasks): add status filter`, `fix(auth): refuse tokens issued before a password change`, `perf(search): use both GIN indexes`.
Мова: ідентифікатори, гілки, коміти й назви тестів — англійською; документація й спілкування — українською.

## Що запускати

```bash
# backend (з папки backend/)
npm run lint && npm run typecheck && npm run format:check
npm test                  # unit; npm run test:cov додає поріг покриття
docker compose --profile test up -d db_test && npm run test:e2e     # e2e на окремій БД (є й тест двох інстансів: TEST_REDIS_URL=redis://localhost:6380)
npm run test:mutation     # Stryker: чи впали б тести, якби код був неправильний (кілька хвилин)
npm run openapi:export    # після зміни API: оновити openapi.json

# frontend (з папки frontend/)
npm run lint && npm run typecheck && npm run format:check
npm run test:cov          # Vitest з порогом покриття
npm run api:types         # після зміни openapi.json: оновити згенеровані типи
npm run test:e2e          # Playwright (спершу стек; локально проти dev: E2E_BASE_URL=http://localhost:5173)
./ops/visual.sh           # візуальні знімки публічних сторінок у контейнері (update — прийняти новий вигляд)
npm run lighthouse        # бюджети продуктивності

# безпека й продуктивність (з кореня)
./ops/security-scan.sh all    # Trivy образів, gitleaks історії, SBOM
./ops/load/run.sh             # навантажувальний тест k6 на копії з 60 000 задач
```

Git-хуки (Husky, ставляться командою `npm install` у корені):

- `pre-commit` — ESLint і Prettier **лише для змінених файлів** (lint-staged);
- `commit-msg` — перевірка формату Conventional Commits;
- `pre-push` — типи backend і frontend.

Хуки допомагають, але не замінюють CI: перевіряйте повний набір самі. Не обходьте хуки (`--no-verify`) без вагомої причини.

## Тести: що й навіщо

- **Unit** (поруч із кодом): кожен публічний метод сервісу, guard-и, фільтри; Prisma мокається.
- **E2E backend**: кожен ендпоїнт — без токена (401), некоректне тіло (400), чужий ресурс (404), успіх; справжній `AppModule` і БД.
- **Frontend**: компоненти й хуки з MSW; доступність через axe на кожній сторінці й діалозі.
- **Playwright**: наскрізні сценарії у браузері, зокрема живі оновлення між двома браузерами та завантаження файлу.
- **Мутаційні тести** і **поріг покриття** — щоб тести справді щось перевіряли (`docs/QUALITY.md`).

Тест описує поведінку, а не реалізацію: `it('returns 404 when the task belongs to another project')`.

## Бази даних і міграції

Схема змінюється через `npx prisma migrate dev --name <verb_noun>` у `backend/`; нову міграцію комітять разом зі `schema.prisma`.
**Вже закомічену міграцію не редагують.** Міграції пишемо сумісними назад (спершу додати, потім у наступному релізі прибрати),
бо відкіт образу не скасовує міграцій (`docs/OPERATIONS.md`). Деструктивні команди (`migrate reset`, `down -v`) — лише на dev-БД і свідомо.

## Безпека

- Секрети лише в `.env` (не комітяться), змінні проходять через `backend/src/config/env.schema.ts`.
- Новий публічний маршрут: `@Public()` + коментар причини + ліміт частоти + тест «без токена» (`docs/THREAT_MODEL.md`).
- Знайшли вразливість — не відкривайте публічну issue, напишіть власнику напряму.

## Релізи

Версії й `CHANGELOG.md` створює **release-please** з історії комітів: коли в `main` потрапляють `feat`/`fix`, бот відкриває «Release PR»;
злиття цього PR створює тег `vX.Y.Z` і запис у журналі змін. Вручну версії не міняють. Деплой на сервер — окрема ручна дія
(workflow «Deploy to production», `docs/OPERATIONS.md`), а не наслідок релізу.

## Коли щось ламається

`docs/RUNBOOK.md`: ознаки, що перевірити, що робити.
