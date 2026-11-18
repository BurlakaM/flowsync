# 44. Git hooks

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D44 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Husky + lint-staged: the root `package.json` exists **only** for the hooks (`prepare: husky`); the lint-staged config lives in each package, so ESLint and Prettier use their own settings; `commit-msg` checks Conventional Commits, `pre-push` checks types

## Alternatives considered and why not

Native git hooks in `.githooks` (no dependencies, but they are not installed automatically after `git clone`); `simple-git-hooks`; a monorepo tool (D15)
