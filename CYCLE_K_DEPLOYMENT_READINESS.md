# CYCLE K DEPLOYMENT READINESS — TitanApt (2026-11-12)

Preparation only. **Nothing was deployed, migrated in production, or exposed publicly** —
per the approval gates. This document is the deployment plan for the owner's approval.

## 1. Deployment blockers (must be resolved before production)

| # | Blocker | Severity | Owner action |
|---|---|---|---|
| 1 | **Managed PostgreSQL does not exist yet** — the dev topology uses an embedded, file-backed Postgres on :55432. Production needs a managed DB with automated daily backups + point-in-time recovery. | **High** | Provision managed Postgres (see §4) |
| 2 | **`SESSION_SECRET` / `CSRF_SECRET` production values** must be generated fresh (32+ byte random) and stored in the host's secret manager. Never reuse dev values. | **High** | Generate at deploy time |
| 3 | **Dependency advisories** — 10 npm audit findings (2 critical in the dev/test chain, zod runtime advisory mitigated by 64 kb body cap + rate limits). Breaking fixes (vitest 5, zod 4, prisma 7) need an approved upgrade cycle. | Medium | Schedule upgrade cycle; ship with mitigations acceptable short-term |
| 4 | **Automated DB backups + restore rehearsal** — backup script exists (`scripts/tmp-db-backup.mjs`) but no schedule and no tested restore. | Medium | Enable managed backups; rehearse restore once |
| 5 | **`COOKIE_SECURE=true` + `TRUST_PROXY` correctness** behind the chosen proxy/CDN. | Medium | Set env at deploy; verify headers |
| 6 | Working tree uncommitted (all Cycle A–K work). | Medium | Commit + tag a release before deploying |
| 7 | Lint tooling absent; optional but recommended before team-based maintenance. | Low | Add ESLint in a future cycle |

## 2. Required environment variables (exact, from `apps/api/src/env.ts` + scripts)

| Variable | Purpose | Required | Notes |
|---|---|---|---|
| `NODE_ENV` | `production` in prod | Yes | zod-enum validated |
| `PORT` | API port (default 4000) | Yes | |
| `DATABASE_URL` | Postgres connection string | Yes | Managed DB in prod |
| `TEST_DATABASE_URL` | Test DB (CI only) | Dev/CI | |
| `WEB_ORIGIN` | Web URL for CORS allow-list | Yes (prod) | Feeds `trustedOrigins` |
| `COOKIE_SECURE` | Force `Secure` cookies | Yes (prod) | Also auto-on when NODE_ENV=production |
| `TRUST_PROXY` | Trust proxy hops for rate-limit IP correctness | Yes (prod, behind proxy) | |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY_NAME` | Bootstrap admin | Yes (first boot) | `AUTO_SEED_ADMIN` gates seeding |
| `AUTO_SEED_ADMIN` | Whether to seed the admin | Prod: set deliberately | |
| `WEB_DIST_DIR` | Where the API serves the built SPA | Yes (single-host deployment) | |
| `UPLOAD_DIR` | Avatar upload storage | Yes | Needs a persistent volume |
| `NO_REPEAT_DAYS` | Practice no-repeat window | Optional (defaults) | |
| `WEAK_AREA_MIN_ATTEMPTS` / `WEAK_AREA_MIN_THRESHOLD` | Weak-area detection tuning | Optional (60) | |
| `SESSION_SECRET` / `CSRF_SECRET` | Token signing / CSRF | Yes (prod) | In root `.env` for dev; secret manager in prod |

Never commit real values. `.gitignore` already excludes `.env` / `.env.*`.

## 3. Recommended hosting architecture (matches the existing stack — no technology migration)

**Single-host container for API + static web + managed Postgres** (the API already serves
`WEB_DIST_DIR`, which keeps CORS/cookies simplest):

```
Browser ──HTTPS──▶ CDN/proxy (TLS, HSTS) ──▶ App host (Node 22 container: API :4000 + built web dist)
                                                ├─▶ Managed PostgreSQL (backups, PITR)
                                                └─▶ Persistent volume (UPLOAD_DIR avatars)
```

- Health checks: `GET /health/live` (liveness) and `GET /health/ready` (readiness + DB probe
  with real content counts) — both verified 200 this cycle.
- Logging: existing `requestId` middleware + structured error payloads; ship container stdout
  to the host's log drain.
- HTTPS: terminate at the proxy; `COOKIE_SECURE=true`, `TRUST_PROXY=1`.

## 4. Hosting provider comparison (indicative)

| Provider | Fit | Postgres | Persistent volume | Notes |
|---|---|---|---|---|
| Railway | Best single-container fit | Managed, daily backups | Yes | Fastest path; app + DB in one place |
| Render | Very good | Managed (free tier pauses — use paid) | Disk add-on | Simple deploy from git |
| Fly.io | Good | Managed Postgres | Volumes | More ops control, more knobs |
| VPS (Hetzner/DO + Coolify/Dokku) | Full control | Self-managed (own backups) | Native | Cheapest at scale; owner maintains backups |
| Vercel/Netlify + separate API | Possible | External | n/a | Splits CORS/cookie setup; not recommended for this codebase shape |

## 5. Deployment procedure (for approval — not executed)

1. Commit the working tree; tag `cycle-k`.
2. Provision managed Postgres; create a dedicated app role (least privilege).
3. Set env vars (§2) in the host's secret store; generate fresh `SESSION_SECRET`/
   `CSRF_SECRET` (32-byte random), `COOKIE_SECURE=true`, `NODE_ENV=production`,
   `WEB_ORIGIN=https://<domain>`, `TRUST_PROXY=1`.
4. Build: `npm run build` (web dist + API bundle + shared).
5. **Production migration (approval gate):** `npm run db:deploy` → `prisma migrate deploy`
   applies the 6 existing migrations. All are additive/historic; verified clean on the dev DB
   (`migrate status`: up to date). Never run `migrate dev` against production.
6. Seed content once (admin + topics/lessons/companies/questions via the existing seed) —
   **never resets user data**; `AUTO_SEED_ADMIN` deliberate.
7. Start the container; verify `/health/live` → 200, `/health/ready` → 200, then
   signup/login/practice smoke on a throwaway account.
8. DNS + TLS for the domain; update `WEB_ORIGIN`; enable host firewall (only 80/443).
9. Enable automated daily DB backups + a 7-day retention minimum; rehearse one restore.

## 6. Rollback strategy

- Container: redeploy previous image/tag.
- Migrations: only additive history so far — rollback = redeploy previous app version
  (schema stays forward-compatible); use `prisma migrate resolve` for failed-marking only.
- Database: restore from managed backup / latest dump file.

## 7. Post-deploy verification checklist

- `/health/live`, `/health/ready` 200 · login works · CSRF mutations work · dashboard shows
  real data · avatars upload/serve · rate-limited endpoints return 429 after burst ·
  security headers present (CSP/HSTS) · cookies `Secure; HttpOnly; SameSite=Lax`.
