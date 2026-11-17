# FlowSync — експлуатація (прод на VPS)

Скрипти лежать у `ops/`, працюють із Docker Compose і не потребують нічого, крім bash та Docker.
**Деплой на прод ще не робився** (за вказівкою власника): усе нижче перевірено локально, крім кроків, позначених «лише на VPS».

## Перевірки здоров'я

| Ендпоїнт | Що означає | Коли падає |
|---|---|---|
| `GET /api/health/live` | процес живий, відповідає | лише якщо завис сам процес |
| `GET /api/health/ready` (і `GET /api/health`) | API може обслуговувати трафік: БД відповідає, Redis відповідає (лише якщо задано `REDIS_URL`) | `503`, коли відмовила залежність |

Чому два: liveness навмисно не торкається БД. Інакше збій Postgres змусив би оркестратор безкінечно
перезапускати здоровий API. Readiness лише забирає інстанс із балансування (Caddy перевіряє його кожні 10 с).

## Бекап і відновлення

```bash
./ops/backup.sh            # pg_dump → backups/flowsync-<UTC>.dump + .counts, старші за RETENTION_DAYS (14) видаляються
./ops/restore-verify.sh    # відновлює найновіший дамп у тимчасову БД і порівнює кількість рядків та міграції
```

- Файл отримує остаточне ім'я лише після того, як `pg_restore --list` зміг його прочитати: обірваний дамп не маскується під бекап.
- `restore-verify.sh` — це і є доказ, що бекап придатний. Запускайте його за розкладом, а не лише «колись».
- Розклад (cron на VPS): `0 3 * * * cd /opt/flowsync && ./ops/backup.sh >> backups/backup.log 2>&1`, перевірка відновлення раз на тиждень.
- Дампи лежать на тому ж сервері: для реальної стійкості їх треба копіювати на інше сховище (лише на VPS; не налаштовано).

## Деплой і відкат

1. CI зелений → workflow `Deploy` публікує образи `flowsync-back|front:<sha>`.
2. Власник вручну запускає workflow **Deploy to production** (`workflow_dispatch`) з тегом `<sha>`.
3. На VPS виконується `ops/deploy.sh <sha>`: свіжий бекап → `docker compose up -d` → `ops/smoke-test.sh`.
4. Smoke-тест провалився → автоматично повертається попередній тег (він зберігається в `.deployed-tag`).

Важливо: відкат образу **не відкочує міграції БД**. Тому міграції пишемо сумісними назад
(спочатку додати, потім у наступному релізі прибрати), а перед кожним деплоєм робиться бекап.

### Одноразове налаштування VPS (лише на VPS, ще не зроблено)

1. Docker + Compose, клон репозиторію в `/opt/flowsync`, DNS `A`-запис на сервер.
2. Кореневий `.env`: `POSTGRES_PASSWORD`, `DOCKER_USERNAME`, `DOMAIN`, `ACME_EMAIL`; `backend/.env`: `JWT_SECRET` ≥ 32 символів, `COOKIE_SECURE=true`, `NODE_ENV=production`, `CORS_ORIGINS` на ваш домен.
3. Секрети репозиторію GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (окремий ключ лише для деплою), `VPS_KNOWN_HOSTS` (вивід `ssh-keyscan`).
4. Середовище `production` у GitHub із обов'язковим рецензентом (за бажанням).
5. Перший запуск: `COMPOSE_FILES="-f docker-compose.yml -f docker-compose.vps.yml" ./ops/deploy.sh <sha>`.

## Smoke-тест

`./ops/smoke-test.sh <base-url>` перевіряє: liveness, readiness, головну сторінку, SPA-fallback на глибокому посиланні,
`401` на закритому API, `404` на Swagger, заголовки CSP і `X-Content-Type-Options`. Дає код виходу ≠ 0 при будь-якому провалі.

## Спостережуваність

Три сигнали: **метрики** (що відбувається в цілому), **трейси** (що сталося з одним запитом), **логи** (деталі).
Їх зв'язує `requestId` і `trace_id`: pino додає `trace_id` у кожен рядок логу, а `X-Request-Id` повертається клієнту й у тілі помилки.

```bash
# Dev: бекенд шле трейси, Prometheus збирає метрики, Grafana їх показує
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318 docker compose --profile observability up -d
```

| Що | Де |
|---|---|
| Дашборд «FlowSync API» (RPS, 5xx, p50/p95/p99, повільні маршрути, черга пошти, сокети, event loop, пам'ять) | http://localhost:3001 |
| Prometheus: цілі й алерти | http://localhost:9090 |
| Jaeger: трейси (HTTP → Prisma → Redis → BullMQ → Socket.IO в одному trace) | http://localhost:16686 |
| Сирі метрики | `GET /api/metrics` на backend (:3000); nginx віддає там 404 |

- **Метрики:** `prom-client`; мітка `route` — шаблон маршруту (`/api/projects/:id`), невідомі URL зводяться до `unmatched`:
  інакше кожен id чи сканер створював би нову часову серію. Черга пошти й сокети читаються в момент scrape, без фонового опитування.
- **Трейси:** OpenTelemetry (`src/config/instrument.ts`, перший імпорт `main.ts`); вимкнені, доки порожня `OTEL_EXPORTER_OTLP_ENDPOINT`.
  Prisma має власний інструментатор, BullMQ — `bullmq-otel`: трейс листа тягнеться від HTTP-запиту до воркера.
- **Помилки:** Sentry (`SENTRY_DSN` для backend, `VITE_SENTRY_DSN` для frontend при збірці). Лише помилки: без трасування й запису сесій.
  Backend відправляє тільки `5xx`; frontend — винятки маршрутів (не 404/403).
  **У проді додайте хост DSN у `connect-src` у `frontend/security-headers.conf`**, інакше CSP блокуватиме звіти.
- `METRICS_TOKEN` додає перевірку bearer-токена на `/api/metrics`, якщо Prometheus стоїть поза Docker-мережею.
- SLO й алерти: `docs/SLO.md`.

## Outbox подій

Кожна зміна даних пише подію в таблицю `outbox_events` **в тій самій транзакції**, що й зміну. Одразу після коміту подію
доставляють підписникам (аудит, сповіщення, real-time); те, що не вдалося, повторює `OutboxRelayService` (раз на 2 с).
Доставка «щонайменше один раз», тому підписники ідемпотентні (унікальні `eventId` в аудиті й сповіщеннях).

| Статус | Значення |
|---|---|
| `PENDING` | чекає доставки; `attempts`, `last_error`, `next_attempt_at` показують, що пішло не так і коли наступна спроба (2, 4, 8 … 128 с) |
| `DONE` | доставлено; записи старші за 7 днів видаляються |
| `DEAD` | 8 невдалих спроб; **потрібна людина** (алерт `OutboxEventDead`) |

```bash
# Що застрягло і чому
docker compose exec db psql -U postgres -d flowsync -c "SELECT id, type, attempts, last_error, next_attempt_at FROM outbox_events WHERE status <> 'DONE' ORDER BY created_at"

# Після виправлення причини (наприклад, повернули підписника): дати DEAD-подіям ще одну серію спроб
docker compose exec db psql -U postgres -d flowsync -c "UPDATE outbox_events SET status='PENDING', attempts=0, next_attempt_at=now() WHERE status='DEAD'"
```

Безпечно повторювати довільну подію: підписники не створять дублів. Метрики: `flowsync_outbox_events{status}`,
`flowsync_outbox_oldest_pending_age_seconds`; алерти `OutboxEventDead`, `OutboxLagging`.

## Кілька інстансів API

З `REDIS_URL` Socket.IO працює через Redis-адаптер: оновлення, яке обробив один інстанс, доходить до браузерів, підключених до
іншого. Воркери outbox теж безпечні для кількох інстансів (`SKIP LOCKED`). Без Redis API має працювати **одним інстансом**:
інакше частина користувачів не отримуватиме живих оновлень.

## Конфлікти редагування й курсори

- `PATCH /tasks/:id` вимагає `version`; якщо хтось зберіг задачу раніше, відповідь `409` (UI показує повідомлення й перезавантажує задачу).
- Активність і коментарі читаються за курсором (`?limit=&cursor=`); `nextCursor: null` означає останню сторінку.

## Безпека: скани й акаунти

```bash
./ops/security-scan.sh images    # збирає прод-образи й сканує Trivy: падає на HIGH/CRITICAL, для яких уже є виправлення
./ops/security-scan.sh secrets   # gitleaks по всій історії git (.gitleaks.toml: відомі хибні спрацювання)
./ops/security-scan.sh sbom      # CycloneDX-опис складу образів у sbom/ (у CI це артефакт на 90 днів)
```

У CI те саме робить джоба `security`; `codeql.yml` (статичний аналіз) працює на push, PR і щотижня. Прийняті винятки — у
`.trivyignore` із причиною й датою перегляду (зараз порожній). Знайшли вразливість в образі: оновіть пакет у `package.json`/Dockerfile,
а не додавайте в ignore без причини.

**Користувач заблокований** (5 невдалих входів): блокування саме знімається за 15 хв, або користувач скидає пароль («Забули пароль?»).
Зняти вручну:

```bash
docker compose exec db psql -U postgres -d flowsync -c "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE email = 'user@example.com'"
```

**Листи підтвердження й скидання пароля** — звичайні листи через ту саму чергу (див. «Outbox» і BullMQ вище); у dev їх видно в Mailpit
(http://localhost:8025). Без налаштованого SMTP листи не йдуть, тож скидання пароля й підтвердження недоступні: у проді SMTP обов'язковий.

**Міграції Prisma 7:** `prisma migrate deploy` береться з `prisma.config.ts` (копіюється в прод-образ). Образ містить CLI Prisma заради
цієї команди, тому він великий (~1,1 ГБ); якщо це заважатиме, винести міграції в окремий одноразовий образ.
