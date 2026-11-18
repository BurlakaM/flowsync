# 22. Access model

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D22 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

The project owner is `Project.ownerId`; additional participants are `ProjectMember`; access is checked in services. User roles are `enum Role`

## Alternatives considered and why not

The owner also in `ProjectMember`: duplicates data

## Consequences

- The owner is a project column, members are rows: one query answers "can this user see this project".
- Roles inside a project beyond owner and member need a role column in `ProjectMember`.

## When to revisit

When organizations or teams appear (a user in a group that owns projects), the model needs another level.
