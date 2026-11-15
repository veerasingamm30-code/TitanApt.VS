# CYCLE K SECURITY REPORT — TitanApt (2026-11-12)

Structured assessment of authentication, authorization, web security, and environment
security. No secret values are printed anywhere in this report. Findings were verified by
code inspection and live probes.

## 1. Authentication (verified)

| Control | Implementation | Status |
|---|---|---|
| Registration | email + password, zod-validated, duplicate email 409, signup rate limiter 10/h | PASS (probe: duplicate 409) |
| Login | Argon2id verify; wrong password 401 generic message; login limiter 10/15 min | PASS (probe matrix 9/9) |
| Logout | session row deleted + cookie cleared; subsequent request 401 | PASS (probe: logout invalidates) |
| Password hashing | `@node-rs/argon2` — memoryCost 19456, timeCost 2, parallelism 1 (OWASP-aligned) | PASS |
| Enumeration safety | `verifyDummyPassword()` burns a dummy Argon2 verify when the email is unknown — timing equalised | PASS (code-verified) |
| Session creation | 32-byte `randomBytes` token, **stored SHA-256-hashed** (`Session.tokenHash`), cookie `ta_session` HttpOnly, SameSite=lax, `secure` in production, 7-day expiry | PASS (code + DB: 0 live sessions >8 days) |
| Session expiration | `expiresAt` checked on attach; expired rows rejected | PASS |
| Session invalidation | DB-backed — deleting the row kills the session everywhere | PASS |
| Auth middleware | `attachSession` + per-route guards; protected routes 401 without a session | PASS (probe: protected 401) |

## 2. Authorization & data isolation

- Every user-scoped query filters by the session's `userId`; the integrity probe proved 0
  unowned attempt rows and orphan-free chains (CYCLE_K_DATABASE_REPORT §2).
- Admin routes (`/api/admin`) enforce role checks (covered by the API test suite
  "enforces admin authorization" — PASS).
- Cross-user access attempts fail closed: unauthenticated `/api/dashboard` → 401 (live probe).

## 3. Web security

| Control | Evidence | Status |
|---|---|---|
| CSRF | `requireCsrf` on the entire `/api` scope; `ta_csrf` cookie + `x-csrf-token` header double-submit; probes prove mutations need both | PASS |
| Security headers | Live response (curl): CSP (`default-src 'self'`, `connect-src 'self' http://localhost:5173`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS, X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin, COOP same-origin | PASS |
| XSS | React escaping + no `dangerouslySetInnerHTML` in lesson/answer rendering paths; CSP as defence-in-depth | PASS |
| SQL injection | Prisma query builder / tagged templates only — no string-concatenated SQL found in routes | PASS |
| Input validation | zod schemas on env + route inputs; 64 kb JSON body cap | PASS |
| CORS | Allow-list from `trustedOrigins`; live probe: `http://evil.example` receives **no** `Access-Control-Allow-Origin` header (Vary: Origin, credentials true) | PASS |
| Rate limiting / brute force | general 600/15m, auth 30/15m, login 10/15m, signup 10/h, write 120/min; standard draft-7 headers observed live (`RateLimit: limit=600`) | PASS |
| Sensitive info exposure | Error payloads carry only code/message/requestId; no stack traces or secrets in responses; `.env` git-ignored and never committed | PASS |
| Health endpoints | `/health/live` + `/health/ready` intentionally mounted **outside** `/api` (no CSRF/session needed for load-balancer checks) — verified 200; anything under `/api` without a session → 401 | PASS |

Note on a probe during this cycle: `GET /api/health/*` returns 401 by design — the health
routes live at `/health/*`. This is correct behaviour, not a vulnerability.

## 4. Environment security

- `.env` (root) holds DATABASE_URL, SESSION_SECRET, CSRF_SECRET, etc.; `.gitignore` excludes
  `.env`, `.env.*` (keeps `!.env.example`); git status confirms no tracked secret files.
- `apps/api/src/env.ts` validates the full env with zod and fails fast; repo-root `.env`
  discovery for workspace scripts.
- Embedded dev Postgres credentials are local-only and documented in the script — dev
  topology, not a production posture.

## 5. Dependency vulnerabilities (`npm audit`, executed this cycle)

**10 advisories: 2 critical, 5 high, 3 moderate.** Classification by exposure:

| Package | Severity | Exposure | Fix | Decision |
|---|---|---|---|---|
| tinypool ≤2.1.1 (prototype pollution → RCE gadgets) | critical | dev-only (vitest worker pool) | vitest 5 (breaking) | Documented; not executed |
| vitest ≤4.1.10 | critical | dev-only | vitest 5 (breaking) | Documented; not executed |
| vite ≤6.4.3 (range via chain) | high | dev-only (Vite dev server + build tool) | vitest 5 chain (breaking) | Documented; not executed |
| vite-node ≤2.2.0-beta.2, @vitest/mocker, esbuild ≤0.24.2 | moderate | dev-only | vitest 5 chain | Documented |
| prisma 6.13–7.10 / @prisma/config / deepmerge-ts <8 | high | CLI/tooling (the runtime `@prisma/client` is not in the flagged ranges) | prisma 7.10.1 (breaking) | Documented |
| zod <4.6.6 (memory exhaustion validating oversized constrained collections) | high | **runtime** (API request + env validation) | zod 4.6.7 (major, breaking) | Documented with mitigations |

Why fixes were not applied now: every fix is a **breaking major upgrade** (vitest 2→5,
zod 3→4, prisma 6→7). The project rules forbid breaking changes and unnecessary dependency
churn without approval, and a forced `npm audit fix --force` would touch hundreds of
packages on the eve of a release. Mitigations already in place for the runtime zod advisory:
64 kb JSON body cap, layered rate limiters, zod schemas constrain collection sizes at the
route boundary.

**Recommended:** a dedicated, approved dependency-upgrade cycle (vitest 5 chain + zod 4 +
prisma 7 incl. `prisma.config.ts` migration) with the full gate suite re-run.

## 6. Status summary

| Area | Status |
|---|---|
| Authentication | PASS |
| Authorization / isolation | PASS |
| Web security (CSRF/XSS/SQLi/headers/CORS/rate limits) | PASS |
| Environment & secrets | PASS |
| Dependency audit | Executed — 10 advisories documented (dev-chain dominated; 1 runtime advisory mitigated; breaking fixes deferred to an approved upgrade cycle) |
