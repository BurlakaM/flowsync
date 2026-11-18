# 35. Production operations

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D35 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Scripts in `ops/` in plain bash + Docker Compose; `docker-compose.vps.yml` (images from a registry + Caddy); `pg_dump` backup with a row-count file and `restore-verify.sh`; manual deploy (`workflow_dispatch`) with automatic rollback on a smoke test; liveness does not touch dependencies, readiness checks the DB and Redis (if configured)

## Alternatives considered and why not

Kubernetes/Ansible/Terraform (overkill for one VPS); `pgBackRest`/WAL archiving (PITR is needed when the data matters, not in a pet project); auto-deploy on every push (the owner wants to control the moment)

## Consequences

- Rolling back after a failed smoke test needs neither a human nor registry requests.
- A rollback does not undo migrations: migrations must be backward compatible, and a backup is taken before every deploy.
- A deploy is a deliberate manual action (`workflow_dispatch`).

## When to revisit

When there are several servers or zero-downtime deploys are needed, move to orchestration (blue/green) instead of a single `compose up`.
