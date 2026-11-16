# Frontend (React) — правила

Спільні правила: `../AGENTS.md`. План і поточна фаза: `../docs/ARCHITECTURE_PLAN.md`.
Цей файл описує архітектуру frontend (Vite + React 19 + TypeScript). Фундамент готовий (фаза 5); фічі додаються у фазі 6.

## Стек

Vite · React 19 · TypeScript strict · `react-router` v8 (імпорт з `react-router`, `RouterProvider` з `react-router/dom`) ·
TanStack Query v5 · `react-hook-form` + `zod` · Tailwind CSS 4 + shadcn/ui · axios ·
Vitest + Testing Library + MSW · Playwright (e2e, фаза 7). Потрібен Node ≥ 22.22.
Не додавай Redux, Bootstrap, jQuery, styled-components; нову бібліотеку спершу запропонуй власнику.

## Структура

```
src/
├─ app/         main.tsx, app.tsx, provider.tsx, router.tsx, routes/
├─ assets/
├─ components/  ui/ (shadcn), layouts/, errors/
├─ config/      env.ts
├─ features/<feature>/
│  ├─ api/         функції запитів + query keys + useQuery/useMutation хуки
│  ├─ components/  UI цієї фічі
│  ├─ hooks/       (якщо потрібні)
│  ├─ types/
│  └─ index.ts     публічний API фічі
├─ hooks/       спільні хуки
├─ lib/         api-client.ts, query-client.ts, auth-storage.ts, utils.ts
├─ testing/     setup.ts, test-utils.tsx, mocks/
└─ types/
```

**Напрямок імпортів:** `components, hooks, lib, config, types` → `features` → `app`.
Фіча **не імпортує іншу фічу** (правило ESLint `no-restricted-imports`): їх складають разом на рівні `app/routes`.
Лінтер ловить імпорти через `@/features/...` і `@/app`, але не ловить відносні шляхи на кшталт `../../tasks/x`: у фічах використовуй лише `@/`.
Дані однієї фічі, потрібні іншій, передає сторінка в `app/routes` через пропси (наприклад, учасники проєкту → `assignees` форми задачі); скинути кеш чужої фічі можна лише через її експортований хук `useRefresh*`.
Із фічі назовні експортується лише те, що перелічено в її `index.ts`; з інших місць не імпортуй її внутрішні файли.

## Шаблони

API-шар фічі (запит + ключі + хук в одному місці; `api-client` повертає `response.data`):

```ts
// features/tasks/api/get-tasks.ts
export const tasksKeys = {
  all: ['tasks'] as const,
  list: (projectId: number) => [...tasksKeys.all, 'list', projectId] as const,
};

export const getTasks = (projectId: number): Promise<Task[]> =>
  api.get(`/projects/${projectId}/tasks`);

export const useTasks = (projectId: number) =>
  useQuery({ queryKey: tasksKeys.list(projectId), queryFn: () => getTasks(projectId) });
```

Мутація з інвалідацією кешу:

```ts
export const useCreateTask = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.list(projectId) }),
  });
};
```

Форма (схема `zod` — єдине джерело правди для типів і валідації):

```tsx
const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  description: z.string().max(5000).optional(),
});
type Values = z.infer<typeof schema>;

const form = useForm<Values>({ resolver: zodResolver(schema) });
```

## Правила

**Дані й стан**
- Запити до API — лише через `lib/api-client.ts` і хуки TanStack Query в `features/*/api`. Жодного `fetch`/`axios` у компонентах і жодного `useEffect` для завантаження даних.
- Серверний стан живе в TanStack Query й не дублюється в `useState`/`zustand`. Фільтри, сторінка, сортування — в URL (search params).
- Access-токен живе лише в пам'яті (`lib/auth-storage.ts`), у `localStorage`/`sessionStorage` його не пишуть. Refresh-токен — `httpOnly` cookie, JS його не бачить: сесію після перезавантаження відновлює `useRestoreSession`, а прострочений токен оновлює `api-client` (один спільний `POST /auth/refresh` на всі паралельні запити).
- Змінні середовища — лише `VITE_*`, читаються через `config/env.ts`. У фронтенді секретів не буває.

**Компоненти**
- Функціональні компоненти, іменований експорт (default лише для lazy-сторінок у `app/routes`). Один компонент на файл.
- Файли kebab-case (`create-task-dialog.tsx`), компоненти PascalCase, хуки `use-*.ts`, типи пропсів — `interface XProps`.
- Кожен екран обробляє три стани: завантаження, помилка, порожньо. Не показуй порожню таблицю замість помилки.
- Складність розв'язуй композицією (children, slots), а не десятком булевих пропсів; prop drilling глибше 2 рівнів → Context або композиція.
- Не додавай `useMemo`/`useCallback`/`memo` без виміряної проблеми.
- `key` у списках — стабільний id, не індекс.

**Стилі та UI**
- Tailwind-класи й токени теми; без inline-стилів і власних CSS-файлів, крім `index.css` із темою.
- Компоненти shadcn додаємо в `components/ui` командою CLI (`npx shadcn@latest add <name>`) й не переписуємо без потреби.
  У новому реєстрі немає компонента `form`: для форм використовуй `field` разом із `react-hook-form`.

**Типи**
- Без `any` і `@ts-ignore`; типи відповідей API беруться з `src/types/api.generated.ts` (генерується з `backend/openapi.json`: `npm run api:types`, файл не редагують). У `features/*/types` лише аліаси на згенеровані схеми й суто UI-типи.

**Доступність**
- Кожне поле має `<label>`; кнопки — `<button>`, посилання — `<a>/<Link>`, не `div` з `onClick`.
- Діалоги й меню — через shadcn/Radix (фокус і клавіатура готові). Іконка-кнопка має `aria-label`.

## Тести

- Vitest + Testing Library: шукай елементи за роллю й підписом (`getByRole`, `getByLabelText`), а не за класами чи `data-testid`.
- Мережу мокай через MSW (`testing/mocks`), а не мокай `axios` чи хуки.
- Покривай: хуки/мутації фіч, форми (валідація, успіх, помилка сервера), захищений маршрут.
- Рендер у тестах — через `testing/test-utils.tsx` (QueryClient, Router).
- Доступність: нова сторінка чи діалог додається в `app/accessibility.test.tsx` (`expectNoA11yViolations`, axe; контраст у jsdom не перевіряється).
- Наскрізні сценарії — Playwright у `e2e/` проти прод-подібного стеку (`npm run test:e2e`); локально береться встановлений Chrome.

## Чекліст нової фічі

1. `features/<name>/` зі структурою вище; публічний API в `index.ts`.
2. `api/`: функції, query keys, хуки; типи.
3. Компоненти з трьома станами (loading / error / empty).
4. Маршрут у `app/routes`, lazy-завантаження.
5. Тести (компонент/хук + MSW).
6. Жодного імпорту з інших фіч; lint проходить.
7. Видалено старий код; відмічено пункт у плані.
