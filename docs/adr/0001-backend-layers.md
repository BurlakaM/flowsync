# 1. Backend layers

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D1 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Controller → Service → Prisma. A separate `*.repository.ts` only when a query is complex or reused

## Alternatives considered and why not

Hexagonal (brocoders), use-case classes (Novu): too many files for CRUD
