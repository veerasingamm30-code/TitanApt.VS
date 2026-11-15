# TitanApt Baseline Audit

Generated: 2026-11-13 (working session). Scope: pre-implementation snapshot of the
existing workspace taken before the current fix cycle. Nothing in this document is
a claim of new work; it records what was already present.

## 1. Repository state (git status at session start)

- Branch: `master` (head: `3eb92d8` "Complete 5-level learning paths…").
- The working tree carried a large body of **pre-existing uncommitted work** from
  previous sessions, including modifications to:
  - `apps/web/src/components/CompanyMarquee.tsx`, `CompanyOrbit.tsx`, `ui.tsx`
  - `apps/web/src/pages/LandingPage.tsx`, `DashboardPage.tsx`, `ProgressPage.tsx`,
    `CrackTimePage.tsx`, `LearningHubPage.tsx`, `MockPages.tsx`, `PracticePages.tsx`
  - `apps/web/src/styles.css`, `apps/web/src/marquee.css`, `apps/web/src/lib/api.ts`
  - `apps/api/src/routes/*` (auth, content, dashboard, learning, mock, public), `metrics.ts`
  - `packages/shared/src/index.ts`, `prisma/seed.ts`, `prisma/data/*`
  - Deleted tracked files: `Img-pdf/image.png`, `apps/web/src/components/StreakChart.tsx`
- Untracked files included: `Img-pdf/Problems/` (user screenshots), the horizontal
  TitanApt GIF, eight company logo PNGs (tata-elxsi, redington, intellect,
  newgen, nucleus, happiest-minds, sasken + others), `apps/web/src/components/DailyStreakCard.tsx`,
  `scripts/browser-audit.mjs`, several `CYCLE_K_*.md` reports, `docs/evidence/browser/*`.
- **Preservation rule applied:** none of that work was reverted; all changes in this
  cycle are additive or surgical edits on top of it.

## 2. Architecture (verified)

| Layer | Technology | Location |
|---|---|---|
| Web | React 19 + TypeScript + Vite 6 + react-router 7, plain CSS | `apps/web` |
| API | Express + Prisma (PostgreSQL, embedded on :55432 in dev) | `apps/api` |
| Shared | `@titanapt/shared` types/constants | `packages/shared` |
| Tests | Vitest (web: 17 tests, api: 26 tests), `scripts/browser-audit.mjs` browser walk | workspace |
| Tooling | npm workspaces; scripts: `typecheck`, `test`, `build`, `dev` (with-db) | root `package.json` |

Routing (`apps/web/src/App.tsx`): `/` landing, `/login`, `/signup`, then
`/app/*` protected shell (dashboard, learn, learning, practice, crack-time, mocks,
companies, readiness, progress, bookmarks, settings, admin).

## 3. Theme management (verified, reused — not replaced)

- `public/theme-init.js` applies `titanapt-theme` (dark/light) and `titanapt-accent`
  (orange/green/purple/blue) from localStorage before React hydrates.
- `src/lib/theme.ts` + `SettingsPage` provide `applyTheme()` — instant, persisted,
  no refresh required.
- Tokens in `styles.css`: `:root[data-accent=…]` and `:root[data-theme=…]` define
  `--accent`, `--accent-strong`, `--accent-soft`, `--accent-on`, `--amber`, `--teal-deep`.

## 4. Company identity mapping (single source of truth)

- PostgreSQL `Company` table (seeded from `prisma/data/companies.json`, 33 verified
  profiles) is the single identity source.
- Logo convention used everywhere: `/company-logos/<slug>.png`
  (`apps/api/src/routes/public.ts`, `dashboard.ts`, `CompanyPages.tsx`,
  `MockPages.tsx` via `CompanyMark`).
- Canonical "Top 25" list verified against `Img-pdf/MOCK TEST.pdf.pdf`
  ("Top 25 Indian IT Companies — Company-Style Mock Tests, 30 questions × 25
  companies"). The eight additional verified companies (Accenture, Cognizant,
  Capgemini, IBM, DXC, NTT DATA, CGI, UST) remain on the Companies page; they are
  not part of the Top-25 marquee sequence.
- All 25 Top-25 logo files existed and visually matched the supplied reference
  sheet `Img-pdf/IT Company Logo.png` ("Top 25 IT Companies — Official Logos").

## 5. Issues found at baseline (feeding this cycle)

1. **Marquee motion**: user-reported "not moving". Root causes identified: (a)
   `.lq-marquee:hover .lq-track { animation-play-state: paused !important }` froze
   the belt whenever the pointer was anywhere over the full-width band; (b) the
   global `prefers-reduced-motion` kill (`styles.css` ~line 7581) plus
   `overflow: hidden` left reduced-motion users a frozen, unscrollable strip.
2. **Dashboard still used the old Orbit** (`CompanyOrbit.tsx` + `.company-orbit*`
   CSS) — user screenshot marked "Delete orbit".
3. **Crack Time focus strip** on the dashboard (user-circled for removal).
4. **Motivational banner** had limited content (user-circled for upgrade).
5. **Progress page** carried the user-circled explanatory `.streak-strip`
   paragraph below the Daily Streak card.
6. **Logo presentation**: `.lq-logo` used `filter: brightness(0) invert(1)`,
   bleaching every logo into a white silhouette — conflicts with the requirement
   to preserve original brand colours; several crops also still carried sheet
   card-border artefacts (fixed at asset level; see fix report).
7. **PDF tabs**: `/resources/*.pdf` files open in the browser's built-in PDF
   viewer, which no web page can brand — app favicon is correctly wired for all
   HTML documents (`index.html` → `/favicon.png`).

## 6. Previous reports consulted

`FINAL_DELIVERY_REPORT.md`, `BUG_FIX_REPORT.md`, `TEST_RESULTS.md`,
`CYCLE_K_*` series, `PROJECT_AUDIT.md`, `IMPLEMENTATION_PLAN.md` — they document
the earlier cycles (learning-path seeding, streak card, marquee/orbit history,
auth hardening, PDF question import). No unresolved item in them contradicts the
plan above; the orbit had been re-introduced on the dashboard in an earlier cycle
and is removed in this one per the user's explicit instruction.
