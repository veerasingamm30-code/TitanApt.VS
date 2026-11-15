# TitanApt Complete Fix Report

Generated: 2026-11-14. Companion document: `docs/TITANAPT_BASELINE_AUDIT.md`
(the pre-implementation snapshot). This report covers the fix cycle that followed
it: logo repair, marquee rebuild, dashboard changes, theme integration, PDF
favicon investigation, project-wide bug/undefined audit, and all testing that was
actually executed.

---

## 1. Project Audit

- **Structure / architecture** — inspected and recorded in the baseline audit:
  React 19 + TypeScript + Vite web app (`apps/web`), Express + Prisma API
  (`apps/api`, PostgreSQL on :55432 in dev), shared types package, npm
  workspaces, Vitest suites (web 17, api 26), Playwright-free CDP browser audit
  (`scripts/browser-audit.mjs`, system Edge headless).
- **Previous reports reviewed** — `FINAL_DELIVERY_REPORT.md`, `BUG_FIX_REPORT.md`,
  `TEST_RESULTS.md`, the `CYCLE_K_*` series, `PROJECT_AUDIT.md`,
  `IMPLEMENTATION_PLAN.md`. Their completed work (learning paths, streak card,
  auth hardening, PDF import) was preserved; nothing was rebuilt or repeated.
- **Initial Git status** — recorded in the baseline audit: a large body of
  pre-existing uncommitted work (modified routes/pages/components, deleted
  tracked files, untracked reports/scripts/screenshots). **All of it was
  preserved; nothing was reverted, committed, or pushed.**

### Issues discovered (and their dispositions)

| # | Issue | Root cause | Disposition |
|---|---|---|---|
| 1 | Marquee "not moving" (user report) | `.lq-marquee:hover .lq-track { animation-play-state: paused !important }` froze the belt whenever the pointer entered the full-width band; global `prefers-reduced-motion` kill + `overflow:hidden` left reduced-motion users with a frozen, unscrollable strip | Fixed — see §2 |
| 2 | Dashboard used the old Orbit component | superseded design; user marked screenshot "Delete orbit" | Replaced with marquee `variant="app"`; `CompanyOrbit.tsx` + all `.company-orbit*` CSS removed |
| 3 | Crack Time focus strip on dashboard | user-circled for removal | Removed (`.study-target-strip` markup + CSS); Crack Time page and nav link remain fully functional |
| 4 | Progress page explanatory paragraph | user-circled for removal | `.streak-strip` markup + CSS removed; 14-day activity chart kept |
| 5 | Logos bleached to white silhouettes | `.lq-logo` used `filter: brightness(0) invert(1)`; crops carried the source sheet's white background/card borders | Assets repaired at pixel level (below) + light-plate presentation; no CSS filters on any logo |
| 6 | PDF tabs show browser favicon | direct `/resources/*.pdf` URLs render in the browser's built-in PDF viewer, which no web page can brand | Investigated; app favicon verified correct for all HTML routes; limitation documented honestly (§4) |
| 7 | Undefined/reference errors | none found | See §5 |

---

## 2. Logo Repair

### Asset-level repair (33 files in `apps/web/public/company-logos/`)

The logo crops came from the white logo sheet, so several carried baked-in white
backgrounds and light-blue card-border artefacts. Two scripted passes (backups in
`C:\Users\acer\AppData\Local\Temp\opencode\logo-backup`):

1. **Pass 1** — border-edge flood fill; cleared residual border slivers.
2. **Pass 2** (authoritative) — restore from backup, then flood-fill from the
   image edges *through transparency*, erasing every reachable light background
   pixel (sheet white, light plate greys, card border + anti-aliasing). Artwork
   enclosed by logo strokes and dark logo text is unreachable and untouched.

Verified with contact sheets rendered on dark and light canvases: all 33 logos
show clean transparency and original brand colours (TCS blue, Infosys blue,
HCLTech blue, Wipro multicolour, Tech Mahindra red/blue, Zoho's multi-colour
cube, etc.). Originals recoverable from the backup folder.

### Presentation convention

New `.lq-logo-plate` (marquee) mirrors the app's existing `.company-mark-logo`
white-plate convention used by Mock Test briefs and company pages: brand colours
on a light plate, `object-fit: contain`, no CSS filters (`filteredLogos: 0`
verified in-browser).

### Pre-login (landing marquee) — browser-verified

- 50 cards rendered = 2 seamless halves × 25; the 25 unique names are exactly
  the Top-25 list from `Img-pdf/MOCK TEST.pdf.pdf` (TCS → Sasken Technologies,
  including "Oracle Financial Services Software" for OFSS).
- 50/50 logo images loaded (`brokenImgs: 0` after decode settle).
- Motion measured in-browser: belt drifts left continuously
  (x: 0 → −43.8 → −86.9 over two 1 s samples ≈ 44 px/s; designed constant speed).
- Hover pause scoped to the strip itself (`.lq-track-scroll:hover`), not the
  whole band — verified by the audit's A2 check.
- `prefers-reduced-motion` (the user's real browser has it enabled):
  animation freezes, duplicate half hidden, strip becomes manually scrollable —
  verified in-browser and by audit A3.
- Info panel: clicking the TCS card opened the verified profile panel
  (logo + website link + sign-in CTA) — audit A4 and in-browser screenshot.
- No horizontal page overflow; no orbit leftovers.

### Authenticated dashboard

- Orbit replaced by marquee `variant="app"`: 50 cards, 0 broken logos,
  cards link to `/app/companies/<slug>` (verified: Infosys card → profile page
  with correct h1 and hero logo).
- Banner upgraded: headline "Every Number Has a Story. Every Problem Has a
  Solution." with the continuation line and gold tagline "Dream Big. Practise
  Daily. Think Clearly. Crack Your Dream Job." (token-driven amber).
- Crack Time strip and study-target strip absent; Crack Time page itself
  untouched and passing its checks (H1–H3).

### Company modal / profile page

- `/app/companies/infosys` renders h1 "Infosys" with the hero logo loaded.
- Audit B2 verifies marquee card → correct profile page end-to-end.

### Mock Test logo verification table

The authoritative reference is `Img-pdf/MOCK TEST.pdf.pdf`; logos verified
against the official sheet `Img-pdf/IT Company Logo.png`. In-app verification:
`/app/mocks` → "Show all 25 company mocks" → **25 company-mock cards, 25 logo
images, 0 broken**; opening the TCS brief showed h1 "Tata Consultancy Services
(TCS) mock", brief logo loaded, 30 questions preserved.

| # | Company | Authentic logo | Correct mapping | Image loading |
|---|---|---|---|---|
| 1 | Tata Consultancy Services (TCS) | ✔ verified | ✔ | ✔ loaded (browser + audit) |
| 2 | Infosys | ✔ | ✔ | ✔ |
| 3 | HCLTech | ✔ | ✔ | ✔ |
| 4 | Wipro | ✔ | ✔ | ✔ |
| 5 | Tech Mahindra | ✔ | ✔ | ✔ |
| 6 | LTIMindtree | ✔ | ✔ | ✔ |
| 7 | Zoho Corporation | ✔ | ✔ | ✔ |
| 8 | Persistent Systems | ✔ | ✔ | ✔ |
| 9 | Coforge | ✔ | ✔ | ✔ |
| 10 | Mphasis | ✔ | ✔ | ✔ |
| 11 | L&T Technology Services (LTTS) | ✔ | ✔ | ✔ |
| 12 | KPIT Technologies | ✔ | ✔ | ✔ |
| 13 | Hexaware | ✔ | ✔ | ✔ |
| 14 | Zensar Technologies | ✔ | ✔ | ✔ |
| 15 | Tata Elxsi | ✔ | ✔ | ✔ |
| 16 | Oracle Financial Services Software | ✔ | ✔ | ✔ |
| 17 | Redington | ✔ | ✔ | ✔ |
| 18 | Birlasoft | ✔ | ✔ | ✔ |
| 19 | Cyient | ✔ | ✔ | ✔ |
| 20 | Sonata Software | ✔ | ✔ | ✔ |
| 21 | Intellect Design Arena | ✔ | ✔ | ✔ |
| 22 | Newgen Software | ✔ | ✔ | ✔ |
| 23 | Nucleus Software | ✔ | ✔ | ✔ |
| 24 | Happiest Minds Technologies | ✔ | ✔ | ✔ |
| 25 | Sasken Technologies | ✔ | ✔ | ✔ |

**Verified total: 25 / 25 authentic logos, 25 / 25 correct mappings, 25 / 25
loading.** No missing assets; no fabricated logos. The 8 additional companies
(Accenture, Cognizant, Capgemini, IBM, DXC, NTT DATA, CGI, UST) remain on the
Companies page (33 total in the DB), outside the Top-25 sequence, as designed.

---

## 3. Theme Integration

Uses the existing `data-theme` × `data-accent` token architecture — no new
theme engine. The marquee and tagline consume `var(--accent)` /
`var(--amber)` tokens (`color-mix` derivatives), so all four accents and both
modes propagate instantly.

Verification method: the app's real Settings UI (`.theme-option` /
`.accent-option` buttons), clicked through all 8 combinations with React
commits between clicks; `data-*` attributes and computed tokens sampled after
each click with no reload. Screenshots: orange/dark landing + dashboard,
green/light dashboard, blue/dark dashboard.

| Theme (accent × mode) | Pre-login | After-login dashboard | Mock Test |
|---|---|---|---|
| Orange · dark | ✔ tokens applied | ✔ | ✔ (same document shell) |
| Orange · light | ✔ | ✔ | ✔ |
| Blue · dark | ✔ | ✔ | ✔ |
| Blue · light | ✔ | ✔ | ✔ |
| Purple · dark | ✔ | ✔ | ✔ |
| Purple · light | ✔ | ✔ | ✔ |
| Green · dark | ✔ | ✔ | ✔ |
| Green · light | ✔ | ✔ | ✔ |

All 8 combinations applied immediately (no refresh) with the correct token
values, e.g. orange dark `--accent:#ff7900` / orange light `#b45309`; blue dark
`#60a5fa` / blue light `#2563eb`; purple dark `#a88bff` / purple light
`#6d4aff`; green dark `#38d996` / green light `#167a55`; amber `#ffb020`
(dark) / `#d59432` (light). Logo colours are never theme-filtered — plates stay
light in every theme.

Note (architecture, verified): theme/accent are also persisted server-side per
user profile and re-applied on boot by `AuthContext` — the server profile wins
over localStorage. Switching in Settings applies instantly and only saves to
the profile on "Save changes" (the user's saved profile was left untouched).

---

## 4. PDF Favicon

- `/favicon.png` is wired in `index.html` (`<link rel="icon" type="image/png"
  href="/favicon.png">`) and verified in-browser on the landing page
  (`favicon: "/favicon.png"`, HTTP 200). Every HTML document (app routes
  included) therefore shows the TitanApt favicon.
- **Direct PDF links** (`/resources/*.pdf`, e.g. the Learning Hub volumes) open
  in the browser's **built-in PDF viewer**, which displays the browser's own
  icon in the tab; no web technology can brand that tab while the PDF is served
  as a raw document. This is reported as a **technical limitation, not fixed**.
  All PDFs verified reachable (HTTP 200: `volume-1.pdf`,
  `aptitude-question-bank.pdf`).
- If tab branding for PDFs becomes a requirement, the correct path is a custom
  in-app PDF viewer route (an HTML document with its own favicon that embeds
  the PDF). This was **not** implemented in this cycle to avoid changing PDF
  viewing/downloading behaviour without explicit approval.

---

## 5. Bug Resolution & Undefined-Error Audit

| Bug | Root cause | Files | Fix | Evidence |
|---|---|---|---|---|
| Marquee frozen on hover | `!important` pause on the whole band | `marquee.css` | pause scoped to `.lq-track-scroll:hover` only | audit A2 PASS; A1 PASS (keeps running) |
| Marquee frozen + unscrollable under reduced motion | global reduced-motion kill + `overflow:hidden` | `marquee.css` | reduced-motion freezes animation, hides clone half, strip scrolls manually | audit A3 PASS; in-browser verification (user's browser actually has reduced-motion on) |
| White-silhouette logos | `filter: brightness(0) invert(1)` + opaque source crops | `marquee.css`, 33 PNGs | light plates + pixel-level background removal | contact sheets; `filteredLogos: 0`; browser screenshots |
| Images popping in blank mid-scroll | `loading="lazy"` never fires inside an animating strip | `CompanyMarquee.tsx` | eager decode for all 50 small PNGs | `brokenImgs: 0` |
| Orbit on dashboard | superseded component | `DashboardPage.tsx`, `CompanyOrbit.tsx` (deleted), `styles.css` | marquee `variant="app"` | `orbitLeftover: false`; audit B1/B2 PASS |
| Dashboard crack-time strip / Progress paragraph | user-requested removals | `DashboardPage.tsx`, `ProgressPage.tsx`, `styles.css` | markup + CSS removed | in-browser `streakStrip: false`; audit E1 PASS |
| Audit script false-FAIL B1 | expected 25 cards but a doubled loop renders 50; sampled before cold-cache images decoded | `scripts/browser-audit.mjs` | wait for image settle; expect first-half 25 / total 50 | audit re-run B1 PASS |
| Audit script false-FAIL E1 | expected the streak strip the user asked to remove | `scripts/browser-audit.mjs` | expectation updated to "removed (per design)" | audit re-run E1 PASS |
| Audit script false-FAIL F1 (avatar upload 400 INVALID_IMAGE) | **the test fixture was a malformed PNG** — 75 bytes with a truncated IEND chunk; the API's strict PNG walker correctly rejected it | `scripts/browser-audit.mjs` | replaced with a valid 73-byte 4×4 PNG fixture | audit re-run F1 PASS — the app's validation was right all along; no app code changed |

**Undefined/reference-error sweep (per the third task brief):**

- `npm run typecheck` across all workspaces: clean (see §6).
- Full Vitest suites pass; production build passes.
- Browser walk across landing, dashboard, companies (+ profile), mocks
  (+ company brief), progress, crack-time, settings: **0 console errors and 0
  page errors** on every page visited (`consoleErrorCount: 0` /
  `pageErrorCount: 0` in every step, plus audit B3 PASS "zero console errors /
  failed requests").
- The only runtime `ReferenceError` encountered during the whole cycle occurred
  in **my own QA harness** (calling an undefined browse-helper name in Code
  Mode) — not in the application. The one other observed failure (F1 above)
  was a broken test fixture, not an app bug.
- No errors were hidden via optional-chaining blanket, empty catches, or
  disabled checks; no app code needed for these.

---

## 6. Testing Results

| Test | Result | Evidence |
|---|---|---|
| TypeScript check | **PASS** | `npm run typecheck` (all workspaces, `tsc --noEmit`) — clean |
| Unit tests (web) | **PASS** | `npm test -w @titanapt/web` — 17/17 passed |
| Unit/integration tests (api) | **PASS** | `npm test -w @titanapt/api` — 26/26 passed |
| Production build | **PASS** | `npm run build` — built in ~9.8 s (index 0.79 kB, css 128.18 kB, js 542.5 kB) |
| Browser audit (independent, Edge headless CDP) | **PASS 29/29** | `node scripts/browser-audit.mjs` — summary "29 PASS / 0 FAIL (29 checks)"; evidence JSON + screenshots in `docs/evidence/browser/` |
| Browser runtime (paired Chromium, real user profile) | **PASS** | landing marquee motion/50 cards/25 names, panel, dashboard banner+app marquee, company profile, progress, crack-time, mocks (25 logos), TCS brief; 0 console errors throughout |
| Theme matrix (4 accents × dark/light) | **PASS** | Settings-UI driven, all 8 combos applied instantly with correct token values; screenshots |
| Responsive sweep | **PASS** | audit R1: no horizontal overflow at 7 viewports (1920/1440/1024/768/430/390/360, landing + dashboard); tablet/mobile screenshots in `docs/evidence/browser/` |
| Lint (ESLint) | **NOT CONFIGURED** | no ESLint config exists anywhere in the project (only third-party packages ship their own `.eslintrc`s inside `node_modules`); nothing to run — no check was disabled |
| API endpoints | **PASS** | `/api/public/companies` → HTTP 200, 33 companies, correct `logoUrl`s (`/company-logos/<slug>.png`, Top-25 first = tcs) |
| Static assets | **PASS** | HTTP 200: `/favicon.png`, `/titanapt-logo.png`, `/resources/volume-1.pdf`, `/resources/aptitude-question-bank.pdf`, logo PNGs |
| Database | **PASS (read-only)** | PostgreSQL :55432 serving the API (embedded dev instance started by `npm run dev`); no destructive or schema-changing operations performed; all user data, attempts, scores untouched |
| Auth flows | **PASS** | audit K1–K7b: signup, session persistence across reload, logout redirect, valid login, wrong-password rejection, duplicate-signup rejection (UI + API) |
| PDF favicon on direct PDF tabs | **NOT FIXED (limitation)** | browser built-in PDF viewer cannot be branded; documented in §4 |

## 7. Modified Files (this cycle)

| File | Why |
|---|---|
| `apps/web/src/components/CompanyMarquee.tsx` | rewritten: exact Top-25 list/order, `variant: 'landing' \| 'app'`, light logo plates, eager image decode, hover-safe pause |
| `apps/web/src/marquee.css` | plate styles replacing the `brightness(0) invert(1)` filter, theme-token accents (`--lq-accent: var(--accent)`), hover scope fix, reduced-motion scrollable strip, app-variant sizes, scrollbar theming |
| `apps/web/src/pages/DashboardPage.tsx` | banner headline/tagline upgrade, orbit → marquee `variant="app"`, crack-time strip removal |
| `apps/web/src/pages/ProgressPage.tsx` | `.streak-strip` paragraph removal (chart untouched) |
| `apps/web/src/styles.css` | `.company-orbit*`, `.streak-strip`, `.study-target-strip` CSS removal; `.next-quote-tagline` amber token styles |
| `apps/web/src/components/CompanyOrbit.tsx` | **deleted** (superseded by the marquee, per user instruction) |
| `apps/web/public/company-logos/*.png` (33 files) | pixel-level background/border transparency repair, brand colours preserved (backups kept) |
| `scripts/browser-audit.mjs` | B1 count/settle fix, E1 expectation update, F1 valid PNG fixture — all three were false FAILs of the audit harness |
| `docs/TITANAPT_BASELINE_AUDIT.md` | new baseline document |
| `docs/TITANAPT_COMPLETE_FIX_REPORT.md` | this report |

Not modified: all API routes, Prisma schema/seed data, auth, mock-test content
(questions, keys, explanations, scores, history), learning resources, theme
persistence internals.

## 8. Remaining Issues

1. **ESLint is not configured** in this project — linting cannot be run or
   enforced until a config is added. (Explicitly not added this cycle: adding a
   whole-project lint config + dependency was out of scope for a fix-only task.)
2. **Direct PDF tabs cannot show the TitanApt favicon** — browser built-in PDF
   viewer; would need an in-app viewer route (proposed, not implemented).
3. **Marquee speed is CSS-animation based**; extremely old browsers without
   `color-mix()` support will ignore some accent tints (progressive
   degradation only, base colours unaffected).
4. The user's browser runs with `prefers-reduced-motion: reduce` — by design
   the marquee is then a static, manually scrollable strip (this is the
   accessibility behaviour, not a bug).
5. Environment note: the dev-server background process is repeatedly killed by
   workstation restarts; each verification run above restarted it cleanly
   (including clearing a zombie Vite holding port 5173 once).

## 9. Final Status

- Pre-login Top-25 logo marquee: **DONE, verified** (motion, hover, reduced
  motion, logos, panel, no overflow).
- Dashboard orbit removal + marquee app variant + banner upgrade + strip
  removals: **DONE, verified**.
- Logo authenticity/mapping/loading for the 25 mock-test companies:
  **25/25 verified**.
- Four-accent × two-mode instant theming: **8/8 combinations verified**.
- PDF favicon: **app routes verified**; direct-PDF-tab branding documented as a
  browser limitation.
- Project-wide bug audit: **no undefined/reference errors found**; 1 harness
  fixture bug fixed in the audit script; **29/29 independent browser checks
  pass**; typecheck, 43 unit/integration tests, and the production build pass.
- Git working tree: **preserved** (93 changed/untracked entries consistent with
  the baseline; nothing reverted, nothing committed, nothing pushed).
