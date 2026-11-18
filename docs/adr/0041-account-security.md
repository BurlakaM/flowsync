# 41. Account and sessions

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D41 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Password reset and email verification are one-time tokens from an email (`user_tokens`, SHA-256, 1 h / 24 h, single use), placed in the link's `#fragment`; responses do not reveal whether an account exists; lockout after 5 failures for 15 min (`429`); a password change/reset in one transaction invalidates refresh tokens and previously issued access tokens (`passwordChangedAt`); notification emails go only to verified addresses; existing accounts are considered verified

## Alternatives considered and why not

A token in the query string (ends up in logs and `Referer`); automatic verification when the link is opened (mail scanners "burn" it); lockout by IP only (bypassed by rotating addresses); lockout without a reset (a user with no way out)

## Consequences

- The reset link reveals nothing: the same response for a known and an unknown address, one email per minute.
- A password change or reset immediately ends all sessions, including previously issued access tokens.
- Lockout after 5 failures slows brute force but lets someone harass a user for 15 minutes; the reset link lifts the lockout.
- Notification emails go only to verified addresses, so registering with someone else's address is not useful for spam.

## When to revisit

Add TOTP two-factor authentication when real users appear (needs a security settings page; not done).
