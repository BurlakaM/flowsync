# 26. Session

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D26 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

A 15-minute access JWT in memory + a refresh token in an `httpOnly` cookie (`SameSite=Strict`, `Path=/api/auth`), rotation, family revocation on reuse, only a SHA-256 hash in the DB; `COOKIE_SECURE` for HTTPS

## Alternatives considered and why not

JWT in `localStorage` (XSS steals the token); a long-lived access token

## Consequences

- A stolen access token is useful for 15 minutes at most (and is rejected immediately after a password change, ADR 41).
- A stolen refresh token is detected by reuse: the whole family is revoked.
- The browser holds no credentials in `localStorage`: after a reload the cookie restores the session.
- Cost: `SameSite=Strict` and `Path=/api/auth` tie the cookie to a same-origin deployment (through the nginx proxy); a separate API domain would require rework.

## When to revisit

If the API moves to another origin, switch to `SameSite=Lax/None` with CSRF protection for refresh.
