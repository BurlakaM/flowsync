# 25. Типи API на frontend

- **Статус:** прийнято
- **Дата:** 2026-11-16
- **У журналі плану:** D25 (`docs/ARCHITECTURE_PLAN.md`, розділ 3)

## Рішення

`openapi-typescript` генерує `src/types/api.generated.ts` із `backend/openapi.json`; у `features/*/types` лише аліаси; CI перевіряє актуальність. Для пакета потрібен `overrides` на peer `typescript` (він заявляє `^5`, у проєкті TS 6)

## Що розглядали й чому ні

Типи вручну: розходяться з API без попередження
