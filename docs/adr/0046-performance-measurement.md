# 46. Performance measurement

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D46 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

k6 in a container against the production image and a separate DB with 60,000 tasks (`ops/load/`), `RATE_LIMIT_PER_MINUTE` for a raised limit; Lighthouse CI with budgets for public pages; visual snapshots in the official Playwright container (`ops/visual.sh`)

## Alternatives considered and why not

Performance tests on a dev DB with a dozen rows (the problems are invisible); cloud services (accounts); snapshots on the host (fonts and the OS make them unstable)
