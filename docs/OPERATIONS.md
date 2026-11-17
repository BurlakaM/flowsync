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
