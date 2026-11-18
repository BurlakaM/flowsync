# FlowSync — threat model (STRIDE)

One page: what we protect, from whom, with what, and what **is deliberately left unprotected**. This document is not a formality:
it shows where to look first when something goes wrong and what is still not done. Update it together with changes to authorization,
storage or infrastructure.

## What we protect

| Asset | Why it matters |
|---|---|
| Accounts (password, session) | a hijacked account = access to all of the owner's projects |
| Project data: tasks, comments, images | privacy between projects is the product's main promise |
| Integrity of the activity log | trust in changes and notifications rest on it |
| The server and secrets (`JWT_SECRET`, DB, SMTP, S3) | a compromised secret = forging any token |
| Availability | a pet project, but it must not fall below the SLO in `docs/SLO.md` |

## Trust boundaries and entry points

```
Internet ──► Caddy (TLS) ──► nginx (SPA, CSP) ──► API (NestJS) ──► PostgreSQL
 browser                                              │ ├──► Redis (mail queue, Socket.IO)
 (untrusted)                                          │ ├──► S3 (images)
                                                      │ └──► SMTP (email)
The user's email is a separate channel we do not control (password reset and verification rely on it).
```

Everything that comes from the browser (body, headers, cookies, tokens from links) and from email is untrusted. Trusted: the DB, Redis, S3, SMTP
in the internal Docker network (only Caddy is open to the outside; the DB and Redis are not published).

## STRIDE

| | Threat | What is done | What remains |
|---|---|---|---|
| **S** Spoofing | Password guessing | bcrypt; a limit of 5 attempts/min per IP; **account lockout for 15 min after 5 failures**; the same response time for an unknown email (a dummy bcrypt comparison) | the lockout lets someone "silence" another person's account for 15 min (an accepted cost; a password reset lifts it); no 2FA |
| | Session theft | a 15-min access JWT in memory; the refresh token in an `httpOnly` `SameSite=Strict` cookie with rotation and revocation of the whole family on reuse; **a password change/reset revokes all refresh tokens and invalidates previously issued access tokens** (`passwordChangedAt`) | XSS can still act on the user's behalf while the tab is open (the CSP reduces the risk, does not remove it) |
| | Account takeover via password reset | a 32-byte token, only its SHA-256 in the DB, valid for 1 hour and once, older ones cancelled by a new one; the same response for a known and an unknown email; 1 email/min per account; the token is in the `#fragment`, not the query (does not reach logs and `Referer`); the confirmation page requires a click (mail scanners do not "burn" the link) | account security equals the security of the user's mailbox |
| | Registering with someone else's address to spam | notification emails go only to **verified** addresses | the first verification email still goes to any address (once, under the limit of 5 registrations/min per IP) |
| **T** Tampering | Editing someone else's resource | every resource is checked in the service (project membership), someone else's → `404`; permissions in a single CASL map | — |
| | Lost update (two people editing) | optimistic concurrency: `version` + `409` | there is no merge of changes |
| | Role tampering at registration | the role is not accepted from the client (`400`), it is always `USER` | an admin is created directly in the DB |
| | Injection | DTO validation with a field whitelist; Prisma parameterizes queries; the only raw SQL (outbox `claim`, search) uses parameters | — |
| **R** Repudiation | "I didn't do that" | the project activity log, `requestId` in logs and responses, events in the outbox | the log covers changes in projects; sign-ins and password resets are only in logs (pino), with no separate security log |
| **I** Information disclosure | Leaking hashes/secrets through the API | `password` is never in `select`; only explicit `select`s; logs redact `authorization` and `cookie`; secrets only through the zod schema | no encryption at rest at the DB and S3 level (we rely on the disk/hosting) |
| | Account enumeration | password reset and login do not reveal whether an email exists | registration answers `409` if the email is taken (accepted: otherwise registering is impossible) |
| | Access to images | only through the API with a membership check; the object key is not given to the client; file type by bytes, SVG forbidden, up to 2 MB | — |
| | Leaking metrics/Swagger | `/api/metrics` is closed by nginx (404) and optionally by a token; Swagger is disabled in production | — |
| **D** Denial of service | Request flooding | a global limit of 100/min per IP, stricter on authorization and email sending; `helmet`; file size limits | per-IP limits do not protect against a distributed attack (a CDN/WAF is needed) |
| | A subscriber or Redis failure | the outbox retries delivery with backoff, `DEAD` + an alert; mail and sockets work without Redis | a single DB instance; no fault tolerance (the 99.5% SLO accounts for this) |
| | Cascade from a slow SMTP | emails go to a queue (BullMQ) with retries, the request does not wait | — |
| **E** Elevation of privilege | An ordinary user becomes an admin | `@Roles(Role.ADMIN)` via a global guard; ADMIN does **not** bypass project access | — |
| | Every new route "forgotten to close" | the global `JwtAuthGuard`: closed by default, only `@Public()` with a reason comment opens it | — |
| | Supply chain | `npm audit`, Dependabot, **Trivy for images, gitleaks, CodeQL, an SBOM in CI**; images run as an unprivileged user | direct dependencies are not pinned by hash; the scanners' `latest` tags in the script |

## Accepted risks (with a review date)

1. No 2FA: a compromised mailbox = a compromised account. Return to this when real users appear.
2. No WAF/CDN: a distributed DoS is not repelled.
3. Secrets live in `.env` on the server; there is no secret manager.

## What to check after changes

- A new public route → `@Public()` + a comment + a rate limit + a "no token" test.
- A new storage or outbound channel → update the diagram and the table.
- A new environment variable with a secret → only through `config/env.schema.ts`, never into logs.
