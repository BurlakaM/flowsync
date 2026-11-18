# 34. Design system

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D34 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

"Aurora": oklch tokens in `index.css`, light ("paper", indigo → teal) and dark themes with a switcher (`.dark` class, choice stored in `localStorage`, an early script from `public/` because the CSP forbids inline scripts); fonts Inter (text) + Manrope Variable (headings, `@fontsource-variable/manrope`, includes Cyrillic); statuses have their own colors and icons; the color of a project, person or tag is derived from its name (no new DB fields); the existing logo stays

## Alternatives considered and why not

Midnight (dark-first) and Paper (serif) — not chosen by the owner; a new logo — the owner declined
