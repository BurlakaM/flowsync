# Frontend (React) — rules

Shared rules: `../AGENTS.md`. The plan and current phase: `../docs/ARCHITECTURE_PLAN.md`.
This file describes the frontend architecture (Vite + React 19 + TypeScript). The foundation is ready (phase 5); features are added in phase 6.

## Stack

Vite · React 19 · TypeScript strict · `react-router` v8 (import from `react-router`, `RouterProvider` from `react-router/dom`) ·
TanStack Query v5 · `react-hook-form` + `zod` · Tailwind CSS 4 + shadcn/ui · axios ·
Vitest + Testing Library + MSW · Playwright (e2e, phase 7). Node ≥ 22.22 is required.
Do not add Redux, Bootstrap, jQuery, styled-components; propose a new library to the owner first.

## Structure

```
src/
├─ app/         main.tsx, app.tsx, provider.tsx, router.tsx, routes/
├─ assets/
├─ components/  ui/ (shadcn), layouts/, errors/
├─ config/      env.ts
├─ features/<feature>/
│  ├─ api/         request functions + query keys + useQuery/useMutation hooks
│  ├─ components/  this feature's UI
│  ├─ hooks/       (if needed)
│  ├─ types/
│  └─ index.ts     the feature's public API
├─ hooks/       shared hooks
├─ lib/         api-client.ts, query-client.ts, auth-storage.ts, utils.ts
├─ testing/     setup.ts, test-utils.tsx, mocks/
└─ types/
```

**Import direction:** `components, hooks, lib, config, types` → `features` → `app`.
A feature **does not import another feature** (the ESLint `no-restricted-imports` rule): they are assembled together at the `app/routes` level.
The linter catches imports through `@/features/...` and `@/app`, but not relative paths like `../../tasks/x`: inside features use only `@/`.
Data of one feature needed by another is passed by the page in `app/routes` through props (for example, project members → the task form's `assignees`); another feature's cache can be reset only through its exported `useRefresh*` hook.
Only what is listed in a feature's `index.ts` is exported from it; do not import its internal files from elsewhere.

## Templates

A feature's API layer (the request + keys + the hook in one place; `api-client` returns `response.data`):

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

A mutation with cache invalidation:

```ts
export const useCreateTask = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.list(projectId) }),
  });
};
```

A form (the `zod` schema is the single source of truth for types and validation):

```tsx
const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  description: z.string().max(5000).optional(),
});
type Values = z.infer<typeof schema>;

const form = useForm<Values>({ resolver: zodResolver(schema) });
```

## Rules

**Data and state**
- API requests only through `lib/api-client.ts` and the TanStack Query hooks in `features/*/api`. No `fetch`/`axios` in components and no `useEffect` for loading data.
- Server state lives in TanStack Query and is not duplicated in `useState`/`zustand`. Filters, page, sorting — in the URL (search params).
- The access token lives only in memory (`lib/auth-storage.ts`) and is not written to `localStorage`/`sessionStorage`. The refresh token is an `httpOnly` cookie that JS cannot see: after a reload the session is restored by `useRestoreSession`, and an expired token is refreshed by `api-client` (one shared `POST /auth/refresh` for all parallel requests).
- Environment variables are only `VITE_*`, read through `config/env.ts`. There are no secrets in the frontend.

**Components**
- Function components, named exports (default only for lazy pages in `app/routes`). One component per file.
- Files are kebab-case (`create-task-dialog.tsx`), components PascalCase, hooks `use-*.ts`, props types `interface XProps`.
- Every screen handles three states: loading, error, empty. Do not show an empty table instead of an error.
- Solve complexity with composition (children, slots), not a dozen boolean props; prop drilling deeper than 2 levels → Context or composition.
- Do not add `useMemo`/`useCallback`/`memo` without a measured problem.
- A list `key` is a stable id, not an index.

**Styles and UI**
- Tailwind classes and theme tokens; no inline styles and no custom CSS files except `index.css` with the theme.
- shadcn components are added to `components/ui` with the CLI command (`npx shadcn@latest add <name>`) and not rewritten without need.
  The new registry has no `form` component: for forms use `field` together with `react-hook-form`.

**The "Aurora" design (D34)**
- Colors are only tokens from `index.css` (`bg-primary`, `text-muted-foreground`, `bg-status-done-soft`…), with no hex/oklch in components. The brand gradient is `bg-brand-gradient` / `text-brand-gradient`; accent text on a surface is `text-primary-ink` (in the dark theme it is lighter than the button fill).
- Two themes: the `.dark` class on `<html>` is set by `public/theme-init.js` (before the first paint; inline scripts are forbidden by the CSP) and the `useTheme` hook. The tokens switch by themselves, so `dark:` is needed only where there are too few tokens (for example, the translucent tag colors). Check a new screen in both themes and at phone width.
- Statuses are `StatusIcon` and the `status-*` tokens: meaning is carried by the icon's shape, not by color alone. The color of a person, project and tag is derived by `lib/identity.ts` (`Avatar`, `TagChip`, `ProjectImage`): do not add a color to the API and do not store it.
- Headings are `font-heading` (Manrope; `h1`–`h3` already have it), text is Inter, numbers in counters are `tabular-nums`.
- Dropdowns are `OptionSelect` (`field` for forms, `pill` for filters, `icon` for an icon); several visible options — `SegmentedControl`. Radix ignores `className` on `SelectValue`: style the trigger.
- Animations are only keyframes from `index.css`; `prefers-reduced-motion` disables them globally. Hide purely decorative things from screen readers (`aria-hidden`).
- Screen states: loading is `LoadingState` (skeletons), empty is `EmptyState` (with an icon), error is `ErrorState`.

**Types**
- No `any` and no `@ts-ignore`; API response types come from `src/types/api.generated.ts` (generated from `backend/openapi.json`: `npm run api:types`, the file is not edited). `features/*/types` hold only aliases to the generated schemas and purely UI types.

**Accessibility**
- Every field has a `<label>`; buttons are `<button>`, links are `<a>/<Link>`, not a `div` with `onClick`.
- Dialogs and menus go through shadcn/Radix (focus and keyboard are ready). An icon button has an `aria-label`.

## Languages (i18n)

- All interface texts are `t('English sentence')` (`useTranslation`); the text is the key. Outside components (zod schemas, constants) use `tKey('…')`, and the translation happens at display time (`FormFieldError`, `t(STATUS_LABELS[…])`).
- A new text = a row in `src/i18n/uk.ts` in the same commit: the `translations.test.ts` test fails if something is untranslated or the dictionary has extras. Plurals are keys with `_one/_few/_many/_other` (`tasks_count`).
- Format dates through `lib/format-date.ts`, not `toLocale…(undefined)`. We do not translate API messages.

## Real-time

- `app/realtime/use-realtime-sync.ts` listens to the socket and resets the TanStack Query cache according to the `query-keys-for.ts` map (features do not know each other, `app` holds the map). The socket is an enhancement, not a requirement: the app works without it too. In tests the socket is replaced (`testing/fake-socket.ts`).

## Tests

- Vitest + Testing Library: find elements by role and label (`getByRole`, `getByLabelText`), not by classes or `data-testid`. A dropdown is opened and chosen with `chooseOption` from `testing/test-utils.tsx` (Radix Select in jsdom needs the stubs from `testing/setup.ts`).
- Mock the network through MSW (`testing/mocks`), do not mock `axios` or hooks.
- Cover: the features' hooks/mutations, forms (validation, success, a server error), the protected route.
- Render in tests through `testing/test-utils.tsx` (QueryClient, Router).
- Accessibility: a new page or dialog is added to `app/accessibility.test.tsx` (`expectNoA11yViolations`, axe; contrast is not checked in jsdom).
- Playwright: people are created by the `people` worker fixture (`e2e/fixtures.ts`), and they enter the browser through the refresh cookie (`browserFor`), not through the form: registration and sign-in have a 5/min limit.
  Visual snapshots (`e2e/visual.spec.ts`) are created and compared only through `./ops/visual.sh` (a Linux container); do not run them on the host.
- End-to-end scenarios are Playwright in `e2e/` against a production-like stack (`npm run test:e2e`); locally the installed Chrome is used.

## New feature checklist

1. `features/<name>/` with the structure above; the public API in `index.ts`.
2. `api/`: functions, query keys, hooks; types.
3. Components with three states (loading / error / empty).
4. A route in `app/routes`, lazy loaded.
5. Tests (component/hook + MSW).
6. No imports from other features; lint passes.
7. The old code is removed; the item is ticked in the plan.
