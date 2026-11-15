# CYCLE K AUDIT REPORT — TitanApt (2026-11-12)

Cycle: K — Production readiness, security, QA, and the K7 learning-page enhancement.
Method: INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → VERIFY → DOCUMENT. No rebuild, no
architecture replacement, no user-data modifications, no destructive database operations.

## 1. Repository state at cycle start

| Item | Finding |
|---|---|
| Last commit | `3eb92d8` — all Cycle A–J work is uncommitted in the working tree |
| Git-tracked secrets | None — `.gitignore` excludes `.env`, `.env.*`, `.pgdata/`, `.uploads/`, logs |
| Stray tracked file | `{console.error(e)` (deleted in the working tree before this cycle) |
| Prior reports | BUG_FIX_REPORT.md (§1–26), TEST_RESULTS.md, FINAL_DELIVERY_REPORT.md, PROJECT_AUDIT.md — read as historical evidence, re-verified live this cycle |
| Dev stack | Embedded PostgreSQL :55432 + API :4000 + web :5173, started via `scripts/with-db.mjs` |

## 2. Architecture (verified, unchanged)

- **Monorepo (npm workspaces):** `apps/api` (Express + tsx/tsup), `apps/web` (React + Vite 6),
  `packages/shared` (shared schemas/types), root `prisma/` (schema, migrations, seed).
- **Database:** PostgreSQL (embedded in dev on :55432), Prisma ORM, 6 migrations
  (latest `20261108090000_add_lesson_levels_basic_expert`), 27 models.
- **API surface:** /health, /api/auth, /api/public, /api/learning, /api (content, progress,
  dashboard), /api/practice, /api/mocks, /api/study, /api/companies, /api/readiness,
  /api/admin, /api (search). Helmet CSP, CORS allow-list, CSRF on all /api routes, layered
  rate limiters, 64 kb JSON body cap.
- **Frontend:** React SPA (auth-gated /app shell), single production bundle, CSS custom-property
  theming (including accent themes), reduced-motion guard.
- **Content (real, seeded):** 28 topics, 140 lessons with checkpoints, 33 companies (all real
  names/logos), 1,700 questions (1,675 approved + 25 pending), 27 published mocks
  (2 general + 25 company mocks with 750 questions).

## 3. Verified completed work (re-checked live this cycle, not taken from reports)

- Cycle J HTTP probes re-run fresh: **19/19 PASS** (csrf bootstrap, login/me/profile PATCH +
  target persistence, avatar upload/serve/reject/delete, dashboard goal+streak increment after a
  real answer, streakHistory, difficultyCounts payload, Hard-409/Medium-201 pool honesty).
- Auth matrix re-run fresh: **9/9 PASS** (wrong password 401, empty/invalid 400, duplicate
  signup 409, protected 401, login 200, session works, logout invalidates).
- Browser: dashboard hero card, orbit, marquee, Learning Hub, Practice, Mocks, Companies,
  Progress, Settings, Crack Time all render with **0 console errors**.

## 4. K7 enhancement (this cycle's code change)

Target identified: the dashboard hero card `.next-action-card` in `apps/web/src/pages/
DashboardPage.tsx` — the "Primes, factorisation and factor counting" recommendation card with
the dark green gradient (`linear-gradient(140deg, #0a3b36, #0b554c)`), which had ~540 px of
empty space between the description and the action buttons.

Implemented (and nothing else):
- Editorial quote block (`.next-quote`): italic serif ("Every number has a story. Every problem
  has a solution."), orange accent on "Every number" / "Every problem" / "solution"
  (reveal animation to #ffb020), supporting paragraph (`.next-quote-sub`).
- Vertical centring in the card's free space (`margin: auto 0 auto`), so the quote sits in the
  centre-left portion between description and buttons.
- CSS-only entrance animation (`next-quote-in` 0.7s fade-in-up) with an explicit
  `prefers-reduced-motion` block (animations off, accent colour applied immediately).
- Responsive overrides at 1024 px and 720 px; existing heading, description, buttons,
  background and decorative circle untouched.

## 5. Issues identified (severity classified)

| # | Finding | Severity | Action this cycle |
|---|---|---|---|
| 1 | 10 `npm audit` advisories (2 critical, 5 high, 3 moderate): vitest/tinypool/vite/vite-node/esbuild chain (dev-only), prisma CLI chain (dev-time), zod <4.6.6 (runtime) | High (dependency hygiene) | Documented with mitigations + upgrade path; force-breaking upgrades deliberately NOT executed (see CYCLE_K_SECURITY_REPORT §5) |
| 2 | Single-bundle frontend (543.78 KB JS / 131.30 KB CSS, gzip 152/25 KB) — no route-level code splitting | Low (performance) | Documented in CYCLE_K_TEST_RESULTS §5; no change (no unnecessary refactoring) |
| 3 | `npm run lint` script does not exist | Low (tooling) | Reported as NOT AVAILABLE, not invented |
| 4 | Prisma deprecation warning: `package.json#prisma` property will be removed in Prisma 7 | Low | Documented; migration to `prisma.config.ts` belongs to the Prisma 7 upgrade cycle |
| 5 | HTML validation quirks in pre-existing test output (`act(...)` warnings in AuthContext tests) | Info | Pre-existing, tests PASS; noted only |

No incomplete functionality, no new functional bugs, no security weaknesses beyond the
dependency advisories, no database risks, no deployment blockers introduced by this cycle.

## 6. Recommended next actions (for the owner, not executed)

1. Plan a dedicated dependency-upgrade cycle (with its own full test run): vitest 2→5 chain,
   zod 3→4 (API migration review), prisma 6→7 + `prisma.config.ts`. All are breaking changes
   and require approval gates per the project rules.
2. Optional future optimisation: route-level code splitting (React.lazy per page) to shrink the
   initial bundle.
3. Commit the working tree (all Cycle A–K work is currently uncommitted).

## 7. Testing requirements fulfilled in this cycle

`npm run typecheck` PASS · `npm test` 43/43 PASS · `npm run build` PASS · `npm audit` executed
(10 advisories documented) · `npm run lint` NOT AVAILABLE · DB integrity probe 17/17 PASS ·
HTTP probes 19/19 + auth 9/9 PASS · browser + responsive verification PASS.
Full evidence: CYCLE_K_TEST_RESULTS.md.
