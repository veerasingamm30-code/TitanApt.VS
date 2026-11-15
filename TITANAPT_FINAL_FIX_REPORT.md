# TITANAPT_FINAL_FIX_REPORT.md

**Project:** TitanApt (monorepo: `apps/web`, `apps/api`, `packages/shared`, `prisma`)
**Workspace:** `E:\VEERASINGAM\TitanApt.VS`
**Date of fix cycle:** 14–15 Nov 2026
**Scope:** Dashboard duplicate-avatar removal, smart Daily Streak flame activation, project-wide error audit.

This is an existing application. Nothing was rebuilt or replaced; all changes integrate with the current architecture.

---

## 1. Problems identified

| # | Problem | Severity | Root cause |
|---|---------|----------|------------|
| P1 | Duplicate profile avatar rendered beside the orange “+ New practice” button on the Dashboard | UI bug (confirmed by red circle in the uploaded screenshot) | `DashboardPage.tsx` passed an `avatar` JSX block to the shared `PageHeader` component, in addition to the profile chip already rendered by `AppShell`'s top bar. The `PageHeader` component accepted an optional `avatar` prop that no other page used. |
| P2 | Daily Streak flame icon did not respond to actual Practice performance | Feature gap (confirmed by red circle in the uploaded screenshot) | The flame (`DailyStreakCard`) was purely decorative — a single static style, not connected to any practice-performance data. The dashboard API exposed only streak-qualification fields (`todayActivityCount`, `todayQualified`), not today's verified correct Practice answers. |
| P3 | `npm test` (API workspace) failed before any test could run | Build/test blocker | `prisma/seed.ts` reads `Img-pdf/MOCK TEST.pdf.pdf` via `readFile`, but the whole `Img-pdf/` asset folder had been deleted from the working tree (uncommitted deletion). Global test setup (`apps/api/src/test/global-setup.mjs`) runs `prisma seed` inside the embedded test database and crashed with `ENOENT`. |

## 2. Root causes and fixes

### P1 — duplicate profile avatar
- **Root cause:** the dashboard was the only caller of `PageHeader`'s unused `avatar` prop.
- **Fix:** removed the `avatar` JSX block from `DashboardPage`, removed the now-unused `useAuth` import/use in that file, removed the `avatar` prop plumbing from `PageHeader` (so the duplicate cannot be silently reintroduced), and deleted the dead `.dashboard-avatar-link` CSS.
- **Preserved:** the top-navigation profile section (`AppShell` `.user-chip`: picture, display name, “Learner” designation, links to Settings) is untouched. All profile/settings/account functionality remains reachable from the top bar and the sidebar.

### P2 — smart Daily Streak flame activation
- **Root cause:** no server-side signal for “today’s verified correct Practice answers” and no two-state flame styling.
- **Fix (backend):**
  - `apps/api/src/lib/metrics.ts` — added `FLAME_ACTIVATION_CORRECT_COUNT = 4`, documented as a **visual-only** threshold that deliberately does **not** change the streak-day rule (`ACTIVITY_QUALIFY_COUNT = 1`) or any historical streak record.
  - `apps/api/src/routes/dashboard.ts` — computed `todayCorrectCount`: today’s attempts where `isCorrect && mode === 'PRACTICE'`, deduplicated by `questionId`, counted only in the authenticated user’s local calendar day, and returned it plus `flameActivationCount` in the `streak` payload. The counter is derived exclusively from persisted `QuestionAttempt` rows created by the practice answer route after real answer validation.
- **Fix (frontend):**
  - `apps/web/src/components/DailyStreakCard.tsx` — extended `StreakSummary`, computed `flameLit = todayCorrectCount >= flameActivationCount`, and rendered two states (`is-dim` / `is-lit`) with an accessible `title`/`aria-label` showing progress (e.g. “3 of 4 verified correct practice answers today”).
  - `apps/web/src/styles.css` — INACTIVE state: subtle, low-contrast, no glow, no animation. ACTIVATED state: bright orange/yellow gradient built from the theme tokens (`--accent`, `--accent-strong`, `--amber`), a soft two-layer glow and a slow (2.6 s) pulse. `@media (prefers-reduced-motion: reduce)` disables the pulse; no heavy effects, GPU cost is negligible (box-shadow animation only on one 46 px element).
- **Data integrity rules honoured:**
  - only verified correct answers count (server-side `isCorrect`);
  - incorrect answers never increase the counter;
  - opening Practice never activates the flame (state lives on the server);
  - refreshing the Dashboard cannot fake progress (state re-derived from the database);
  - duplicate submissions cannot double-count: the practice route already enforces a per-user `idempotencyKey` unique constraint and a per-session `answeredAt` conflict check, and the counter additionally dedupes by `questionId` per day;
  - the existing daily-streak calculation, history and user progress are untouched (verified by the full existing test suite).

### P3 — broken test setup
- **Root cause:** uncommitted deletion of the tracked `Img-pdf/` assets referenced by the seeder.
- **Fix:** restored the folder from git (`git checkout -- Img-pdf`). No data was deleted; no database was reset.
- **Note:** two other deleted tracked files (`CompanyOrbit.tsx`, `StreakChart.tsx`) are **not** referenced anywhere in the current source (replaced by `CompanyMarquee` and `DailyStreakCard` in the previous cycle) — leaving them deleted; no restore needed.

## 3. Files modified

| File | Change |
|------|--------|
| `apps/web/src/pages/DashboardPage.tsx` | Removed duplicate avatar block and unused `useAuth` import (Task 1) |
| `apps/web/src/components/ui.tsx` | Removed the unused `avatar` prop / `page-header-avatar` wrapper from `PageHeader` |
| `apps/web/src/styles.css` | Removed `.dashboard-avatar-link` rules; added two-state `.daily-streak-flame.is-dim/.is-lit`, `streak-flame-pulse` keyframes and reduced-motion override |
| `apps/api/src/lib/metrics.ts` | Added `FLAME_ACTIVATION_CORRECT_COUNT = 4` with explanatory comment |
| `apps/api/src/routes/dashboard.ts` | Added `todayCorrectCount` + `flameActivationCount` to the `/api/dashboard` streak payload |
| `apps/web/src/components/DailyStreakCard.tsx` | Two-state flame rendering, accessible hint text, extended `StreakSummary` |
| `apps/api/src/test/flame.test.ts` | **New** — integration tests for the flame activation contract (3 tests) |
| `Img-pdf/*` (12 files) | Restored from git (were uncommitted-deleted; the seeder depends on them) |
| `TITANAPT_FINAL_FIX_REPORT.md` | This report |

**Database changes:** none. No migration, no schema change, no data reset. New API fields are additive JSON.

## 4. Tests executed (real commands, real results)

| Check | Command | Result |
|-------|---------|--------|
| TypeScript (all 3 workspaces) | `npm run typecheck` | ✅ pass |
| API test suite (incl. 3 new flame tests) | `npm run test -w @titanapt/api` | ✅ 6 files / **29 passed** (was 26) |
| Web test suite | `npm run test -w @titanapt/web` | ✅ 3 files / **17 passed** |
| Full suite | `npm test` | ✅ 46 tests passed |
| Production build (shared+api+web) | `npm run build` | ✅ success |
| Prisma schema ↔ migrations drift | `prisma migrate diff --from-migrations … --to-schema-datamodel …` | ✅ “No difference detected” |
| Environment validation | loading `apps/api/src/env.ts` against `.env` | ✅ pass |
| Script syntax (14 scripts) | `node --check scripts/*` | ✅ all OK |
| Static asset references | checked `favicon.png`, `theme-init.js`, logos, `src/assets`, `public/resources` | ✅ all present |
| Code hygiene greps | TODO/FIXME/`@ts-ignore`/`: any`/missing React keys | ✅ clean (one static decorative `key={index}` in `LandingPage` — no dynamic reorder, acceptable) |
| Browser verification (dev servers + real Chrome) | manual + browse tooling | ✅ see below |

**New integration tests** (`flame.test.ts`) verify, against the real seeded database and API:
1. fresh learner → `todayCorrectCount = 0`, `flameActivationCount = 4` (flame unlit);
2. 3 correct answers → count stays 3 → 1 **incorrect** answer → still 3 → 4th correct answer → 4 (threshold reached) while `todayQualified`/streak-day behaviour is unchanged;
3. duplicate submission with the same idempotency key returns the stored verdict (`idempotent: true`), a different key on an already-answered question is rejected with 409, exactly **one** `QuestionAttempt` row exists, and the counter advanced by exactly 1.

**Browser verification (Vite 5173 + API 4000, zero console errors throughout):**
- Dashboard header shows greeting, description and **only** the “+ New practice” button — 0 `.dashboard-avatar-link` elements in the header; top bar still shows avatar + “Veerasingam / Learner” chip;
- “+ New practice” navigates to `/app/practice`;
- Daily Streak card renders on Dashboard and Progress pages;
- flame `is-lit` (bright orange, glow) for the signed-in learner with 4 verified correct answers today — matches the live API (`todayCorrectCount: 4`);
- flame `is-dim` (subtle, no glow) verified visually for the inactive state;
- Screenshots saved: `dashboard-flame-lit.png`, `dashboard-flame-dim.png` (temp session folder).

## 5. Remaining issues / notes

1. **Prisma stderr noise in test runs:** the intentional duplicate-email test in `http.test.ts` produces Prisma's own `Unique constraint failed (emailNormalized)` stderr banner. The route correctly converts it to a clean 409 and the test passes; this is Prisma client log verbosity, not an application bug. Left untouched to avoid unrelated changes.
2. **`package.json#prisma` deprecation warning** (Prisma 7 migration to `prisma.config.ts`). Cosmetic, no action taken (out of scope).
3. **Uncommitted refactor of the previous cycle** remains uncommitted (dashboard streak rule change, marquee/orbit swap, DailyStreakCard, this fix's changes). Nothing was committed automatically; the user should review `git diff` and commit.
4. **ESLint:** no ESLint configuration or `lint` script exists in this project; no lint run was performed (no invented commands).
5. **Network/external deps:** none needed — the app uses an embedded local PostgreSQL; all tests ran fully, none skipped.

## 6. Security & data checks

- `.env` is git-ignored and untracked (`git check-ignore` confirms); no secrets exposed in this report or in code.
- Flame counter is scoped to `req.user.id`; user-specific data isolation verified by the API test suite (auth-protected routes, CSRF-protected mutations).
- No user data was deleted or reset; the only data added was by the seeder/test runs on the disposable `titanapt_test` database.

## 7. Final project status

**STABLE — all requested fixes implemented, verified and tested.**
Typecheck ✅ · Tests 46/46 ✅ · Production build ✅ · Schema/migrations in sync ✅ · Browser-verified ✅ · No user data lost ✅
