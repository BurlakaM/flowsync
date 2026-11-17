# FlowSync — runbook: що робити, коли…

Для чергового (зараз це власник), який відкриває цей файл о третій ночі. Кожен розділ: **ознака → що перевірити → що робити → як переконатися**.
Команди — з кореня репозиторію на сервері (`/opt/flowsync`) або локально для dev. Не заходьте в БД з `DROP`/`DELETE` без бекапу.

Корисні посилання: стан і метрики `docs/OPERATIONS.md`, SLO й алерти `docs/SLO.md`, модель загроз `docs/THREAT_MODEL.md`, архітектура `docs/ARCHITECTURE.md`.

## Швидка діагностика (з чого почати завжди)

```bash
docker compose ps                                   # хто впав або «unhealthy»
curl -s https://<домен>/api/health/ready            # 200 = БД і Redis відповідають, 503 = залежність
docker compose logs --tail 100 backend              # останні рядки; кожен має requestId і trace_id
```

Один запит користувача можна простежити: `requestId` є в тілі помилки й заголовку `X-Request-Id`, `trace_id` — у кожному рядку логу
і в Jaeger.

## 1. Сайт не відкривається (5xx, таймаут)

- **Перевірте:** `docker compose ps`; `curl -I https://<домен>/`; `curl -s https://<домен>/api/health/live`.
- **Caddy/сертифікат:** `docker compose logs caddy`. Помилка ACME або «certificate expired» → DNS-запис вказує на сервер? порти 80/443 відкриті?
- **nginx (frontend) unhealthy:** `docker compose logs frontend`, `docker compose restart frontend`.
- **backend не стартує:** `docker compose logs backend`. Типові причини: невалідна змінна середовища (zod пише, яка саме), `JWT_SECRET` коротший
  за 32 символи, міграція впала. Backend **навмисно** не стартує з поганим конфігом.
- **Переконатися:** `./ops/smoke-test.sh https://<домен>` повертає «Smoke test passed».

## 2. Після деплою все погано

`ops/deploy.sh` сам відкочується, якщо smoke-тест провалився. Якщо відкіт не спрацював або проблему видно пізніше:

```bash
cat .deployed-tag                                         # останній тег, що пройшов smoke-тест
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.vps.yml" ./ops/deploy.sh <попередній-sha>
```

**Увага:** відкіт образу **не скасовує міграцій**. Якщо нова міграція була несумісна зі старим кодом — відновлюйте БД з бекапу (розділ 8).

## 3. БД недоступна або /api/health/ready дає 503

- **Перевірте:** `docker compose ps db`; `docker compose logs --tail 50 db`; місце на диску `df -h` (повний диск — найчастіша причина).
- **Не відповідає, але диск вільний:** `docker compose restart db`, зачекайте healthcheck. Дані в томі `pg_data`, перезапуск їх не торкається.
- **Заборонено без дозволу:** `docker compose down -v`, `docker volume rm`, `docker system prune` — вони знищують дані.
- **Переконатися:** `/api/health/ready` → 200; у Grafana p95 і 5xx повертаються до норми.

## 4. Redis недоступний

Ознака: `/api/health/ready` повертає 503 з `redis: down`; листи не йдуть; живі оновлення працюють лише в межах одного інстансу.

- `docker compose restart redis`. Черга листів лежить у томі `redis_data` (AOF), тому поставлені листи переживуть перезапуск.
- Застосунок без Redis **продовжує працювати** (листи йдуть одразу, без повторів), але `ready` показує 503: це сигнал оператору.

## 5. Не приходять листи (підтвердження, скидання пароля, сповіщення)

- **SMTP не налаштований:** у логах backend при старті «Email is off (SMTP_HOST and MAIL_FROM are not set)». У проді SMTP обов'язковий (`SMTP_HOST`, `MAIL_FROM` у `backend/.env`).
- **Черга:** метрика `flowsync_mail_queue_jobs{state="failed"}` > 0 (алерт `MailJobsFailing`) — поштовий сервер відмовляє. Завдання повторюються самі
  (5 спроб, експоненційна затримка); після відновлення SMTP вони дійдуть.
- **Лист «підтвердження» не дійшов:** користувач може натиснути «Надіслати посилання ще раз» (не частіше разу на хвилину).
- **Dev:** усі листи видно в Mailpit, http://localhost:8025.

## 6. Подія застрягла (алерт `OutboxEventDead` / `OutboxLagging`)

Означає: зміна збережена, але аудит, сповіщення або живе оновлення для неї не доставлено.

```bash
docker compose exec db psql -U postgres -d flowsync -c \
  "SELECT id, type, attempts, last_error, next_attempt_at FROM outbox_events WHERE status <> 'DONE' ORDER BY created_at"
```

- `last_error` каже, що саме падає. Виправте причину (наприклад, баг підписника), задеплойте виправлення.
- Дати `DEAD`-подіям ще одну серію спроб (безпечно: підписники ідемпотентні):

```bash
docker compose exec db psql -U postgres -d flowsync -c \
  "UPDATE outbox_events SET status='PENDING', attempts=0, next_attempt_at=now() WHERE status='DEAD'"
```

- `OutboxLagging` без `DEAD`: relay не працює або БД перевантажена — `docker compose logs backend | grep -i outbox`.

## 7. Повільно або багато помилок (алерти `SlowRequests`, `HighErrorRatio`)

1. Grafana «FlowSync API»: який маршрут (панель «Slowest routes»), відколи.
2. Jaeger: знайти повільний трейс цього маршруту; довгі `prisma:client:db_query` — проблема в SQL.
3. Перевірити навантаження на БД (`docker stats`, `pg_stat_activity`). Типова причина — запит без індексу або `COUNT` по великій таблиці
   (див. `docs/PERFORMANCE.md`: так знайшли повне сканування лічильників).
4. Якщо почалось після деплою — відкіт (розділ 2).
5. Вимірювання на копії з даними: `./ops/load/run.sh`.

## 8. Відновлення з бекапу

```bash
ls -lt backups/ | head                                  # доступні дампи
./ops/restore-verify.sh backups/flowsync-<час>.dump     # СПЕРШУ перевірити, що дамп відновлюється (тимчасова БД, прод не чіпає)
```

Відновлення в прод **руйнує поточні дані**, тому це свідома дія власника: зупиніть backend, створіть порожню БД, `pg_restore` у неї,
перемкніть `POSTGRES_DB` або перейменуйте БД, запустіть backend. Перед будь-яким відновленням зробіть ще один бекап поточного стану.
Бекап робиться перед кожним деплоєм (`ops/deploy.sh`) і за розкладом cron (приклад у `docs/OPERATIONS.md`; на VPS його ще треба налаштувати); дампи зберігаються 14 днів.

## 9. Користувач не може увійти

| Ознака | Причина й дія |
|---|---|
| «Too many failed sign-in attempts» (429) | акаунт заблоковано на 15 хв після 5 невдач; саме мине, або користувач скидає пароль («Забули пароль?»). Зняти вручну: `UPDATE users SET locked_until=NULL, failed_login_attempts=0 WHERE email='…'` |
| «Invalid email or password» | звичайна помилка пароля; перевірте, що email без друкарських помилок |
| Лист скидання не приходить | розділ 5; зверніть увагу: форма відповідає однаково для будь-якої адреси (це навмисно, щоб не розкривати акаунти) |
| Після зміни пароля «вилетіли» всі пристрої | так задумано: зміна пароля завершує всі сесії |

## 10. Підозра на компрометацію

- **Секрет витік (`JWT_SECRET`, SMTP, S3, БД):** змініть значення в `.env`, перезапустіть (`docker compose up -d`). Зміна `JWT_SECRET` завершує всі сесії.
- **Підозрілий вхід:** `docker compose logs backend | grep -i "locked\|failed"`; користувачу — скинути пароль (це відкликає всі його сесії).
- **Витік у git:** `./ops/security-scan.sh secrets`; витік вважайте остаточним — змінюйте секрет, а не лише видаляйте файл з історії.

## Після кожної аварії

Запишіть у `docs/ARCHITECTURE_PLAN.md` (журнал) або окремий пост-мортем: що сталося, як помітили, як виправили, що зробити, щоб не повторилось
(алерт, тест, перевірка). Аварія без висновків повториться.
