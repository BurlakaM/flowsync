# 3. Roles

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D3 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

`enum Role { USER ADMIN }` on the `User` model instead of a `role` table

## Alternatives considered and why not

A roles table is only justified with dynamic permissions; role seeding then becomes unnecessary
