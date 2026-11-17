# 44. Git-хуки

- **Статус:** прийнято
- **Дата:** 2026-11-17
- **У журналі плану:** D44 (`docs/ARCHITECTURE_PLAN.md`, розділ 3)

## Рішення

Husky + lint-staged: `package.json` у корені існує **лише** заради хуків (`prepare: husky`); конфіг lint-staged лежить у кожному пакеті, тож ESLint і Prettier працюють зі своїми налаштуваннями; `commit-msg` перевіряє Conventional Commits, `pre-push` — типи

## Що розглядали й чому ні

Нативні git-хуки в `.githooks` (не потребують залежностей, але й не ставляться самі після `git clone`); `simple-git-hooks`; монорепо-інструмент (D15)
