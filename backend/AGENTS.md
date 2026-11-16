# Backend (NestJS) — правила

Спільні правила: `../AGENTS.md`. План і поточна фаза: `../docs/ARCHITECTURE_PLAN.md`.
Цей файл описує **цільову** архітектуру; частина старого коду їй ще не відповідає (див. baseline у плані).
Нову логіку пиши за цими правилами, стару мігруй лише в межах фази.

## Структура

```
src/
├─ main.ts, app.module.ts
├─ config/        env.schema.ts (zod), app-config.service.ts
├─ database/      prisma.module.ts (global), prisma.service.ts
├─ common/        decorators/ guards/ filters/ interceptors/ pagination/ types/
├─ health/
└─ modules/<feature>/
   ├─ dto/                    create-x.dto.ts, update-x.dto.ts, x-response.dto.ts, query-x.dto.ts
   ├─ x.controller.ts
   ├─ x.service.ts
   ├─ x.service.spec.ts       unit-тест поруч із сервісом
   └─ x.module.ts
test/e2e/                     *.e2e-spec.ts
```

Поточний стан до фази 2: фічі лежать у `src/<feature>/`, спільне — у `src/conception/`. Не додавай нічого нового в `conception/`.

## Шари й відповідальність

| Шар | Робить | Не робить |
|---|---|---|
| Controller | маршрут, DTO, `@CurrentUser()`, виклик сервісу, Swagger-декоратори | бізнес-логіку, Prisma, перевірку доступу |
| Service | бізнес-логіку, перевірку доступу, запити Prisma | знання про HTTP (`Request`, `Response`) |
| Repository (необов'язково) | складні/повторювані запити Prisma | логіку авторизації. Створюй лише коли запит використовується ≥ 2 разів або надто великий для сервісу |

Модулі спілкуються лише через експортовані сервіси. Імпорт файлів іншого модуля напряму заборонений.
Цикл залежностей вирішуй винесенням спільного коду, а не через `forwardRef`.

## Шаблон модуля

DTO (`class-validator`; `PartialType` береться з `@nestjs/swagger`, щоб зберігати метадані Swagger):

```ts
export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

Контролер: тонкий, id користувача лише з `@CurrentUser()`:

```ts
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(user.id, projectId, dto);
  }
}
```

Сервіс: перевірка доступу першою, відповідь через `select` (ніколи не віддавай сутність цілком):

```ts
export const taskSelect = {
  id: true, name: true, description: true, status: true, createdAt: true,
} satisfies Prisma.TaskSelect;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async create(userId: number, projectId: number, dto: CreateTaskDto) {
    await this.projects.assertMember(userId, projectId); // чужий проєкт -> NotFoundException
    return this.prisma.task.create({
      data: { ...dto, projectId, createdById: userId },
      select: taskSelect,
    });
  }
}
```

## Правила

**API**
- JSON у camelCase. Колекції повертай з пагінацією (`PaginationQueryDto`).
- Помилки — виключення Nest (`NotFoundException`, `ForbiddenException`, `ConflictException`); не повертай `null` замість 404.
- Помилки Prisma (`P2002`, `P2025`, `P2003`) мапить `PrismaExceptionFilter`; у сервісах не лови їх без потреби.
- Ендпоїнт без guard допустимий лише з `@Public()` і коментарем причини (логін, реєстрація, health).
- Додавай `@ApiProperty`/`@ApiOperation`, якщо Nest CLI plugin цього не робить.

**Автентифікація й доступ**
- Користувач у запиті — `AuthenticatedUser { id: number; email: string; role: Role }`, дістається через `@CurrentUser()`. Ніяких `req.user.sub`.
- Реєстрація завжди створює роль `USER`; роль із тіла запиту ігнорується.
- Доступ до ресурсу перевіряє сервіс (членство в проєкті), а не контролер.

**Дані**
- Prisma лише в сервісах/репозиторіях, ніколи в контролерах. Raw SQL — лише з обґрунтуванням у коментарі.
- Схема змінюється через `npx prisma migrate dev --name <verb_noun>`; **вже закомічену міграцію не редагуй**.
  До фази 3 діє тимчасовий `prisma db push`.
- Перевірка деструктивних міграцій (drop, rename з даними) — лише з дозволу власника.
- Кілька записів, що мають бути атомарними, — `prisma.$transaction`.
- Для списків не допускай N+1: `include`/`select` у одному запиті.

**Код**
- Файли kebab-case із суфіксом ролі (`tasks.service.ts`, `create-task.dto.ts`); один клас на файл; класи PascalCase.
- Без `any`; тип невідомого — `unknown` + звуження. Без `@ts-ignore`.
- `process.env` лише в `config/`; решта коду бере значення з `AppConfigService`.
- Логування — Nest `Logger` (або pino), не `console.log`. Секрети й токени в лог не пиши.
- Паролі — `bcryptjs`, cost з конфігурації. Порівняння — лише `bcrypt.compare`.
- Не змінюй глобальний префікс `api` і порт 3000 без узгодження: на них налаштовано nginx і compose.

## Тести

- **Unit** (`*.spec.ts`): кожен публічний метод сервісу; Prisma мокається через `jest-mock-extended` (`mockDeep<PrismaService>()`).
- **E2E** (`test/e2e`): кожен ендпоїнт — мінімум 401 без токена, 400 на некоректне тіло, 404 на чужий ресурс, успішний сценарій.
  Працюють на окремій тестовій БД; кожен тест готує власні дані.
- Назви: `it('returns 404 when task belongs to another project')` — поведінка, а не реалізація.
- Нова перевірка безпеки (guard, доступ) без тесту не вважається виконаною.

## Чекліст нового модуля

1. DTO (`Create`/`Update`/`Response`/`Query`) із валідацією.
2. Сервіс: перевірка доступу → логіка → `select`.
3. Контролер без логіки, з Swagger-декораторами.
4. Модуль: `exports: [XService]`, якщо його використовують інші.
5. Unit-тест сервісу + e2e ендпоїнтів.
6. Міграція Prisma (якщо змінювалась схема) + оновлений seed.
7. Видалено старий код; відмічено пункт у плані.
