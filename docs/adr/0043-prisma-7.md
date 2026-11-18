# 43. Prisma 7

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D43 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Prisma 7.10 (stable; `latest` on npm points to 8.0 RC), the client through the `pg` driver (`@prisma/adapter-pg`), `prisma.config.ts` instead of `package.json#prisma` and `url` in the schema, the `prisma-client-js` generator is kept

## Alternatives considered and why not

Stay on 6.x (an unfixed `deepmerge-ts` vulnerability in the CLI); Prisma 8 RC (not yet stable); the new `prisma-client` generator (changes all imports, no gain here)

## Consequences

- The `deepmerge-ts` vulnerability in the Prisma 6 CLI is gone; Trivy is clean.
- Prisma 7 runs queries through the `pg` driver in TypeScript: no Rust engine, and a different place to tune (the `pg` pool).
- The CLI reads `prisma.config.ts`; `prisma generate` requires `DATABASE_URL` (a placeholder is supplied during the image build).
- The production image is larger (~1.1 GB) because the CLI is needed for `migrate deploy`.

## When to revisit

Run migrations from a disposable image to shrink the runtime one; move to Prisma 8 once it is stable.
