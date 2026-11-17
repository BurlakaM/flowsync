# 21. Логування й захист API

- **Статус:** прийнято
- **Дата:** 2026-11-16
- **У журналі плану:** D21 (`docs/ARCHITECTURE_PLAN.md`, розділ 3)

## Рішення

`nestjs-pino` (JSON у production, pretty у dev, токени редагуються), `helmet`, `@nestjs/throttler` (100/хв глобально, 5/хв для логіну й реєстрації), `TRUST_PROXY` за nginx

## Що розглядали й чому ні

Власний логер/middleware: дублює готове
