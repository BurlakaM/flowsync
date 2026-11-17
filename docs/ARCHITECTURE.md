# FlowSync — архітектура (C4)

Діаграми за моделлю C4: від картини зверху (хто користується системою) до компонентів усередині backend. GitHub малює блоки
Mermaid прямо в Markdown. Деталі рішень — у `docs/adr/`, процеси й аварії — у `docs/RUNBOOK.md`, цифри продуктивності — у `docs/PERFORMANCE.md`.

## 1. Контекст: хто й навіщо

```mermaid
flowchart LR
    user(["Користувач<br/>веде проєкти й задачі в браузері"])
    admin(["Власник / оператор<br/>деплой, бекапи, моніторинг"])

    subgraph flowsync["FlowSync"]
        system["Трекер задач<br/>проєкти, задачі, коментарі, теги,<br/>сповіщення, живі оновлення"]
    end

    mail[("Поштовий сервер SMTP<br/>листи: підтвердження, скидання пароля,<br/>сповіщення")]
    s3[("S3-сховище<br/>зображення проєктів")]
    sentry[("Sentry (опційно)<br/>звіти про помилки")]

    user -->|"HTTPS: сторінки, API, WebSocket"| system
    admin -->|"SSH, GitHub Actions, Grafana"| system
    system -->|"SMTP"| mail
    system -->|"S3 API"| s3
    system -.->|"HTTPS, лише помилки"| sentry
    mail -.->|"посилання з листа"| user
```

Пошта — окремий канал довіри: на ньому тримаються скидання пароля й підтвердження адреси (див. `docs/THREAT_MODEL.md`).

## 2. Контейнери: з чого складається система

```mermaid
flowchart TB
    browser(["Браузер<br/>React 19 SPA"])

    subgraph host["Сервер (Docker Compose)"]
        caddy["Caddy<br/>TLS, HTTP/3<br/>(лише на VPS)"]
        nginx["frontend: nginx<br/>статика SPA, CSP,<br/>проксі /api і /api/socket.io"]
        api["backend: NestJS 12<br/>REST + Socket.IO,<br/>воркер outbox і черги пошти"]
        db[("PostgreSQL 16<br/>дані, outbox, повнотекстовий пошук")]
        redis[("Redis 7<br/>черга листів BullMQ,<br/>шина Socket.IO")]
    end

    mail[("SMTP")]
    s3[("S3-сховище")]

    subgraph obs["Спостережуваність (профіль observability)"]
        prom["Prometheus"]
        graf["Grafana"]
        jaeger["Jaeger"]
    end

    browser -->|"HTTPS"| caddy --> nginx
    nginx -->|"/api"| api
    api -->|"Prisma 7 + pg"| db
    api --> redis
    api -->|"листи"| mail
    api -->|"зображення"| s3
    prom -->|"scrape /api/metrics<br/>(лише всередині мережі)"| api
    api -.->|"OTLP: трейси"| jaeger
    graf --> prom
    graf --> jaeger
```

| Контейнер | Відповідальність | Чого **не** робить |
|---|---|---|
| nginx | віддає SPA, ставить заголовки безпеки (CSP), проксіює `/api` | не виставляє `/api/metrics` назовні (404) |
| backend | уся бізнес-логіка, авторизація, права, події, листи | не зберігає стан сесії в пам'яті (токени в БД) |
| PostgreSQL | єдине джерело правди; outbox лежить у тій самій БД | не публікується назовні |
| Redis | необов'язковий: черга листів і шина між інстансами API | без нього все працює, але на одному інстансі й без повторів листів |

## 3. Компоненти backend

```mermaid
flowchart TB
    http(["HTTP / WebSocket"])

    subgraph api["backend (NestJS)"]
        direction TB
        guards["Глобальні guard-и<br/>ліміт частоти → JWT → ролі"]
        ctrl["Контролери<br/>auth, users, projects, tasks,<br/>comments, tags, activity, notifications"]

        subgraph services["Сервіси (бізнес-логіка)"]
            direction LR
            projects["ProjectsService<br/>правило доступу (accessFilter)"]
            tasks["TasksService<br/>версії задач, пошук"]
            comments["CommentsService"]
            authsvc["AuthService<br/>блокування, скидання пароля"]
        end

        events["DomainEventsService<br/>transact() + outbox"]
        relay["OutboxRelayService<br/>claim SKIP LOCKED, backoff"]

        subgraph subs["Підписники подій"]
            direction LR
            audit["Журнал аудиту"]
            notif["Сповіщення + листи"]
            rt["Real-time (Socket.IO)"]
        end

        casl["CASL: карта прав"]
        prisma["PrismaService (pg)"]
    end

    pg[("PostgreSQL")]

    http --> guards --> ctrl --> services
    services --> casl
    services --> events
    services --> prisma
    events -->|"запис події в тій самій транзакції"| prisma
    events -->|"доставка одразу після коміту"| subs
    relay -->|"те, що не вдалось"| subs
    relay --> prisma
    subs --> prisma
    prisma --> pg
```

Ключові правила (деталі в `backend/AGENTS.md` і `docs/adr/`):

- Контролер тонкий; сервіс перевіряє доступ першим, повертає `select`-ом, ніколи сутність цілком.
- Усі зміни даних публікують події **в тій самій транзакції** (ADR 37); підписники ідемпотентні.
- Модулі спілкуються лише через експортовані сервіси; «хто бачить проєкт» визначає тільки `ProjectsService` (ADR 24).

## 4. Динамічна картина: новий коментар від запиту до екрана

```mermaid
sequenceDiagram
    autonumber
    actor A as Ганна (браузер A)
    actor B as Богдан (браузер B)
    participant API as backend
    participant DB as PostgreSQL
    participant Mail as Черга листів → SMTP

    A->>API: POST /api/tasks/9/comments
    API->>DB: перевірка доступу до задачі (404 для сторонніх)
    API->>DB: BEGIN: INSERT comment + INSERT outbox_event: COMMIT
    API-->>A: 201 Created
    Note over API,DB: відповідь уже відправлено,<br/>доставка події триває далі
    API->>DB: claim події (UPDATE … FOR UPDATE SKIP LOCKED)
    par підписники (щонайменше один раз)
        API->>DB: аудит: INSERT audit_log (унікальний eventId)
    and
        API->>DB: сповіщення (унікальні eventId + userId)
        API->>Mail: лист лише на підтверджену адресу
    and
        API-->>B: Socket.IO: «у проєкті щось змінилось»
    end
    API->>DB: outbox_event → DONE
    B->>API: GET /api/tasks/9/comments (оновлення кешу)
    Note over API,DB: якщо процес упав після коміту — relay<br/>підхопить подію за ~30 с (lease)
```

## 5. Розгортання

```mermaid
flowchart LR
    dev["Розробник<br/>docker compose up<br/>(dev: hot reload, Mailpit, RustFS)"]
    gh["GitHub Actions<br/>lint, типи, тести, e2e, Trivy,<br/>gitleaks, CodeQL, Lighthouse"]
    reg[("Реєстр образів<br/>flowsync-back / -front:&lt;sha&gt;")]
    vps["VPS: docker-compose.vps.yml<br/>ops/deploy.sh: бекап → up → smoke-тест → відкат"]

    dev -->|"git push"| gh -->|"main зелений: образи"| reg
    reg -->|"ручний workflow<br/>Deploy to production"| vps
```

Деплой на VPS ще не виконувався (за вказівкою власника); усе до нього готове й перевірене локально (`docs/OPERATIONS.md`).
