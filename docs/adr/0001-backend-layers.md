# 1. Шари backend

- **Статус:** прийнято
- **Дата:** 2026-11-16
- **У журналі плану:** D1 (`docs/ARCHITECTURE_PLAN.md`, розділ 3)

## Рішення

Controller → Service → Prisma. Окремий `*.repository.ts` лише коли запит складний або повторюється

## Що розглядали й чому ні

Hexagonal (brocoders), use-case класи (Novu): забагато файлів для CRUD
