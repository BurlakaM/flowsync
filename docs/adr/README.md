# Architecture Decision Records

Кожне суттєве технічне рішення проєкту записано окремо: що вирішили, що відкинули й чому. Це коротка пам'ять проєкту: коли через
пів року хтось (або ви самі) запитає «чому тут так?», відповідь шукають тут, а не в чаті чи коміті.

- Журнал рішень у `docs/ARCHITECTURE_PLAN.md` (розділ 3) — стислий вигляд тих самих рішень. Тут вони розгорнуті.
- У рішень, що найсильніше формують систему, є розділи **«Наслідки»** і **«Коли переглянути»** (позначені ◆).
- Нове рішення: скопіюйте найближчий файл, візьміть наступний номер, додайте рядок в індекс нижче й у журнал плану.
  Прийняті рішення заднім числом не редагують: якщо рішення змінилось, пишуть новий ADR, а в старому ставлять статус «замінено ADR N».

| № | Тема | |
|---|---|---|
| 1 | [Шари backend](0001-backend-layers.md) |  |
| 2 | [БД та міграції](0002-database-and-migrations.md) |  |
| 3 | [Ролі](0003-roles-as-enum.md) |  |
| 4 | [Стиль API](0004-rest-and-openapi.md) |  |
| 5 | [Валідація](0005-validation.md) |  |
| 6 | [Авторизація запитів](0006-closed-by-default-auth.md) | ◆ |
| 7 | [Доступ до ресурсів](0007-resource-access-404.md) | ◆ |
| 8 | [Збірка фронтенду](0008-vite-react-typescript.md) |  |
| 9 | [Роутинг](0009-react-router.md) |  |
| 10 | [Стан](0010-server-state-tanstack-query.md) |  |
| 11 | [UI](0011-tailwind-and-shadcn.md) |  |
| 12 | [Форми](0012-forms.md) |  |
| 13 | [Структура фронтенду](0013-feature-folders.md) |  |
| 14 | [Контракт front↔back](0014-openapi-generated-types.md) |  |
| 15 | [Репозиторій](0015-two-independent-packages.md) |  |
| 16 | [Тести](0016-testing-stack.md) | ◆ |
| 17 | [CI](0017-ci-pipeline.md) |  |
| 18 | [Compose](0018-compose-dev-and-prod.md) |  |
| 19 | [Runtime](0019-node-24-runtime.md) |  |
| 20 | [TypeScript](0020-typescript-6.md) |  |
| 21 | [Логування й захист API](0021-logging-and-api-protection.md) |  |
| 22 | [Модель доступу](0022-project-ownership-model.md) | ◆ |
| 23 | [Міграції](0023-prisma-migrate.md) |  |
| 24 | [Права доступу](0024-project-access-rule.md) | ◆ |
| 25 | [Типи API на frontend](0025-frontend-api-types.md) |  |
| 26 | [Сесія](0026-session-and-refresh-tokens.md) | ◆ |
| 27 | [Request id](0027-request-id.md) |  |
| 28 | [E2E та доступність](0028-e2e-and-accessibility.md) |  |
| 29 | [Події й права](0029-domain-events-and-casl.md) | ◆ |
| 30 | [Черга й пошта](0030-queue-and-mail.md) | ◆ |
| 31 | [Файли](0031-file-storage.md) |  |
| 32 | [Real-time](0032-realtime-socketio.md) | ◆ |
| 33 | [i18n і дошка](0033-i18n-and-board.md) |  |
| 34 | [Дизайн-система](0034-aurora-design-system.md) |  |
| 35 | [Прод-операції](0035-production-operations.md) | ◆ |
| 36 | [Спостережуваність](0036-observability.md) | ◆ |
| 37 | [Доставка подій](0037-transactional-outbox.md) | ◆ |
| 38 | [Конкурентне редагування](0038-optimistic-concurrency.md) | ◆ |
| 39 | [Пагінація зростаючих списків](0039-cursor-pagination.md) | ◆ |
| 40 | [Кілька інстансів real-time](0040-multi-instance-realtime.md) |  |
| 41 | [Акаунт і сесії](0041-account-security.md) | ◆ |
| 42 | [Перевірки безпеки](0042-security-scans.md) |  |
| 43 | [Prisma 7](0043-prisma-7.md) | ◆ |
| 44 | [Git-хуки](0044-git-hooks.md) |  |
| 45 | [Мутаційні тести й пороги](0045-mutation-testing-and-thresholds.md) |  |
| 46 | [Вимірювання продуктивності](0046-performance-measurement.md) |  |
| 47 | [Версії й журнал змін](0047-releases-and-changelog.md) |  |
