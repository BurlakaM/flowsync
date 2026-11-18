# 47. Versions and changelog

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D47 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

release-please (`simple`, one component per repository, `extra-files` bumps the versions of both packages) and Conventional Commits; deploy stays manual

## Alternatives considered and why not

`semantic-release` (publishes without a Release PR, worse for manual control); manual tags; separate package versions (overkill for an app deployed as one)
