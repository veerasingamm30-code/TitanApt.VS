# TitanApt — Final Delivery Report (2026-11-07 upgrade cycle)

Project: `E:\VEERASINGAM\TitanApt.VS` — upgraded in place. The neighboring
`TitanApt` / `TitanApt.2` copies were never touched; no runtime dependencies
were added; all user data (30+ pre-existing accounts) preserved with zero DB resets.

Status vocabulary: PASS / PARTIAL / FAIL / BLOCKED. Full evidence chains live in
[TEST_RESULTS.md](TEST_RESULTS.md) and [BUG_FIX_REPORT.md](BUG_FIX_REPORT.md);
raw probe scripts + JSON results are in `docs/evidence/`.

---

## 1. Delivered features

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Pre-login company marquee (26 companies, right-to-left) | PASS | `CompanyMarquee.tsx` + `marquee.css`: seamless doubled-track loop, hover/focus pause, reduced-motion freeze, clickable → public info panel, signed-in-safe mock CTA. Backed by new public API `GET /api/public/companies` (no user data). |
| 2 | Top-10 3D company orbit (authenticated dashboard) | PASS | Canonical order TCS → Infosys → HCLTech → Wipro → Tech Mahindra → LTIMindtree → Zoho → Persistent → Coforge → Mphasis; 10/10 real logos; hover/tooltip/click/keyboard/touch; 32/32 Playwright UI checks (Cycle F). |
| 3 | Streak analytics chart (≥4 unique correct/day rule) | PASS | Hand-built SVG bars from real attempt data: wrong answers don't qualify, 4 unique correct → day qualifies, mocks/checkpoints/duplicates excluded, idempotent, refresh-persistent. |
| 4 | Boolean Algebra + Programming Logic lessons | PASS | Lesson schema de-unique'd (index instead of unique), 3+3 lessons authored (31 total), per-lesson checkpoint windows, prev/next sibling navigation, correctAnswers verified per lesson over HTTP. |
| 5 | Mock Test UI/UX + selection flow | PASS | Real logos on company cards, difficulty/count/duration config with pool validation, category row (server + client) with deep-linking, impossible configs honestly rejected 409, server-authoritative scoring, attempt persistence. |
| 6 | Topic lessons selection UI | PASS | Learning Hub fixed earlier (8 volumes), lesson detail with siblings; upgraded 2026-11-08: 26 topics now serve full BEGINNER→EXPERT paths (lessonCount=5), calendars-and-clocks from 0 to 5 lessons. |
| 7 | Docs set | PASS | PROJECT_AUDIT.md, IMPLEMENTATION_PLAN.md, TEST_RESULTS.md, BUG_FIX_REPORT.md, FINAL_DELIVERY_REPORT.md (+ README quality gates refreshed). |

## 2. Company-count honesty (explicit verification requirement)

- The uploaded reference `Img-pdf/MOCK TEST.pdf.pdf` is a **Top-25** document → 25 companies.
- The database's 26 canonical companies come from `IT_Companies_Guide_with_Zoho.pdf`,
  with **Zoho as the 26th**. Every company has a matching on-disk PNG logo (26/26).
- **No company was invented** to reach any advertised count; copy now states provenance
  honestly (README Content coverage, landing/auth copy updated to real seeded totals: 28 topics - 136 lessons - 1,675 approved + 25 pending questions - 27 mocks - 26 companies).

## 3. Verification summary (final state)

| Gate | Result |
|---|---|
| `npm run typecheck` (shared/api/web) | PASS |
| `npm test` | PASS 42/42 (25 API + 17 web; latest run 2026-11-08) |
| `npm run build` | PASS (web dist 544.70 KB JS / 131.62 KB CSS; api dist 146.55 KB ESM) |
| `npm run db:seed` | PASS — 28/136/26/1675+25/27; user data preserved |
| Main HTTP integration probe | PASS 34/34 (`docs/evidence/titanapt-integration.*`) |
| Mock category probe | PASS 11/11 (`docs/evidence/titanapt-cat-probe.*`) |
| Production runtime smoke (dist on :4100) | PASS (SPA fallback, signup, learner APIs, practice, mocks, admin) |
| Static assets over HTTP | PASS — `/`, logo PNGs, volume PDFs, `/login` |
| Playwright UI cycles (earlier cycles) | PASS 32/32 ×2 (Cycle F) + search-crash fix cycle D |
| `npm run lint` | BLOCKED — no lint script exists in the project (out of scope, documented) |
| Browser automation in final cycle | BLOCKED — no playwright/puppeteer in the project; HTTP probes + code review used instead (honest note in TEST_RESULTS.md) |

## 4. Constraints honored

- Work confined to `TitanApt.VS`; TitanApt branding only (no SINGAMX present in app code).
- No new runtime dependencies — chart, orbit, and marquee are hand-built SVG/CSS/React.
- No fake data anywhere: streaks from real attempts, search over live rows, mock pools
  from approved questions, servers report honest errors (409/400) on impossible requests.
- No schema resets / no data destruction; migrations applied via `npm run db:deploy`.
- Real accounts created via the real backend for testing; no passwords printed or hardcoded.

## 5. Known limitations (honest)

1. Final-cycle UI verification used HTTP-level probes + code review because browser
   automation was unavailable in that session; earlier Playwright-driven cycles (D–F)
   remain the visual evidence for orbit, search, theme, and responsive layouts.
2. `prisma migrate dev` is unusable in this repo (checksum drift on an old migration);
   `npm run db:deploy` is the sanctioned path — documented for future maintainers.
3. Windows client encoding (WIN1252) restricts lesson JSON content to ASCII-safe text;
   content pipeline now enforces this (glyphs transliterated).
4. No lint script exists; lint gate therefore not claimed.
5. A transient (not-reproducible) seed-count race in `npm test` was observed once while
   a concurrent editor session wrote to the DB; two consecutive clean runs after it.

## 6. State at handover

- Dev stack (`npm run dev`: embedded Postgres :55432, API :4000, Vite :5173) left running for the user; dev log at `.devlog.txt`.
- All five required root documents present and cross-linked; evidence scripts/JSON in `docs/evidence/`.
- No known unresolved product bug remains from the audited scope; every discovered issue is FIXED (or explicitly OPEN/BLOCKED as noted in §3/§5).

## 7. 2026-11-08 expansion: full 5-level learning paths (Cycle G)

Beyond the 2026-11-07 scope, the content library now covers complete lesson paths:

- LessonLevel enum expanded BEGINNER/INTERMEDIATE/ADVANCED -> BEGINNER, BASIC, INTERMEDIATE, ADVANCED, EXPERT
  (migration 20261108090000_add_lesson_levels_basic_expert, applied with prisma migrate deploy; verified by
  scripts/qa/enum-final-check.cjs).
- 105 new lessons authored across 9 batch files and merged into prisma/data/lessons.json by
  scripts/merge-lessons-20261108.cjs (field-schema, slug-uniqueness, order-continuity and ASCII gates).
- 26 topics now serve 5-level paths (BEGINNER+1, BASIC(+1), INTERMEDIATE, ADVANCED, EXPERT, order 1..5),
  incl. calendars-and-clocks which previously had zero lessons. Boolean-algebra and programming-logic
  keep their legacy 3-lesson paths (honest PARTIAL, left untouched).
- Seed total: 136 lessons / 404 checkpoints; /health/ready and /api/topics/:slug verified over HTTP for
  all 26 expanded topics. Full evidence: TEST_RESULTS.md Cycle G.
- Content discipline: no example duplicated across levels (distinct numbers/rules per level), ASCII-only
  authored text, honest sourceRef (TitanApt original, 2026-11-08), 3 practice questions per lesson with
  programmatically re-verified answer keys; several draft arithmetic slips were caught and fixed during
  review (list in TEST_RESULTS.md Cycle G).

---

## 8. 2026-11-09 finishing cycle (Cycle H): 12-requirement spec closed out

Scope: finish the 12-item upgrade spec (new company marquee data, dashboard
company showcase, premium Daily Streak card, 5-level Boolean Algebra and
Programming Logic paths, Progress streak consistency, avatar upload flow,
Learning Hub warning severity, Crack Time custom timer + remaining time,
mock-test logo identity, selection UI/UX audit, auth audit, strict change
control) and re-run the full gate set. Requirement-by-requirement evidence:
[TEST_RESULTS.md Cycle H](TEST_RESULTS.md); bugs found and fixed:
[BUG_FIX_REPORT.md §§18–22](BUG_FIX_REPORT.md).

### What changed in this cycle (summary)

- **Marquee/mock identity (Reqs 01, 09):** 7 missing logo PNGs extracted from `Img-pdf/IT Company
  Logo.png`, 7 new companies from the reference PDF seeded (total 33, all with logos), slug aliases
  for the two PDF-borne mock names wired through `@titanapt/shared` and consumed server-side by the
  mock list/config/detail and public companies endpoints; marquee heading now dynamic; a forward vs
  reverse alias-direction bug in the marquee endpoint was caught by live probing and fixed.
- **Dashboard (Reqs 02, 03, 06):** the 3D company orbit was deleted and replaced with a
  `CompanyShowcase` grid; a new `DailyStreakCard` replicating the supplied streak reference
  (green pill bars, hatched idle bars, crown badge, 7-day goal bar) now reads the authoritative
  streak fields from `GET /api/dashboard`; profile avatar wiring surfaced on the page header.
- **Learning (Reqs 04, 07):** boolean-algebra and programming-logic now serve full 5-level paths
  (14 new lessons, seed 140 total); Learning Hub outcomes are classified server-side into red
  `errors` vs muted `notices` so benign notes no longer alarm users.
- **Crack Time (Req 08):** custom target input verified end-to-end against the server
  (400s on 0/-5/"abc"/700/empty; 200 on a valid custom value) and a remaining-time note added.
- **Auth (Req 11):** full HTTP audit - credentials, enumeration-safety, validation, CSRF,
  protected-route gating, logout invalidation and the 429 login rate limiter all verified live.
- **Change control (Req 12):** zero DB resets, zero runtime dependency additions, `Img-pdf/`
  references untouched, stray files removed, all measured counts re-verified before any copy change.

### Gate results (this cycle)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (3 workspaces) |
| `npm test` | PASS 42/42 (API 25 + web 17; test pins updated to 140 lessons / 33 companies) |
| `npm run build` | PASS (api 147.32 KB ESM; web 541.74 KB JS / 126.49 KB CSS) |
| `npm run db:seed` | PASS - topics=28 lessons=140 companies=33 questions=1675+25 mocks=25+2 |
| Live HTTP probes | PASS - marquee/companies, mock identity, volumes, streak, study target, auth matrix (see Cycle H tables) |
| `npm run lint` | BLOCKED - no lint script exists (unchanged, documented) |
| Browser automation | BLOCKED in this session; HTTP probes + code review used (honest limitation, unchanged) |

### Honest limitations

1. This session had no browser automation: the showcase, streak card and selection states are
   verified at the API/build/CSS level, not by clicking through a rendered page. The CSS audit
   confirms every selected-state class used by the components has a styled rule.
2. The boolean-algebra and programming-logic checkpoint windows are sequential slices of their
   approved pools (126 and 200 questions) - each of the 5 lessons has a window; no new questions
   were invented for them.
3. Learning Hub `notices` (e.g. "Indexed from Img-pdf\\Volume N.pdf.") intentionally remain visible
   as muted text for transparency, rather than being hidden; only errors are red.

---

## 9. 2026-11-10 final master phase (Cycle I): orbit restored, theme-aware streak, real-browser QA

Final phase of the master spec. Three gaps against the authoritative Phase 1-16 spec were closed,
then the site was verified by an independent **real-browser audit** (raw Chrome DevTools Protocol
driving system Edge headless - no automation library exists in this environment; driver kept as
`scripts/browser-audit.mjs`). Full check table + evidence:
[TEST_RESULTS.md Cycle I](TEST_RESULTS.md); new bugs:
[BUG_FIX_REPORT.md A�A�23-24](BUG_FIX_REPORT.md); screenshots + machine-readable results:
`docs/evidence/browser/`.

### What changed in this cycle

- **3D orbit restored on the authenticated dashboard (Phase 3/14-B):** the master spec overrides
  the Cycle-H showcase decision. `CompanyOrbit.tsx` (simplified CSS-3D variant: 3 ring paths,
  10 clickable logo cards, counter-rotation to keep logos upright, responsive + reduced-motion)
  is wired back into `DashboardPage.tsx` ("TOP IT COMPANIES" section); the orphaned
  `CompanyShowcase.tsx` was deleted (no importer, no CSS). Live-verified: 10 cards orbit the
  TitanApt core, click-through to `/app/companies/:slug` works.
- **Streak card follows the theme accent (Phase 4 theme support):** every hardcoded green in the
  `DailyStreakCard` CSS block (fills, flame, crown badge, goal bar, quote arrow, radial glow) now
  derives from `var(--accent)` via `color-mix`; the premium dark shell from the Streack reference
  is retained so dark and light modes stay readable. Live-verified: orange -> green -> orange
  accent switch changes the computed colors and restores exactly.
- **Crack Time "Custom…" fixed (Phase 9):** explicit `value="custom"` option + `targetPicked`
  state; custom input now reveals on selection, saves (47 min), and rejects 700 with the
  5-480 message. Live-verified in the browser.
- **Avatar upload fixed (Phase 7):** the raw-ArrayBuffer upload carried no Content-Type so the
  server's `express.raw` parser never matched and every upload returned 400 EMPTY_FILE;
  `uploadAvatar` now sends `content-type: application/octet-stream`. Live-verified: 201 Created,
  avatar persists in storage, re-serves after reload, renders in the header/sidebar/Settings.
- **Strict change control (Phase 13):** no runtime dependency added, no DB reset, no seed change,
  no unrelated page touched; only the files named above plus the audit driver and reports.

### Independent browser audit result: 29 checks, 29 PASS / 0 FAIL

Signup -> dashboard through the real forms; orbit render + click-through; streak card structure +
theme switching; clean console; marquee loop/hover-pause/reduced-motion/info panel; 28-topic
catalogue + filter; 5-level boolean-algebra and programming-logic; Progress 14-day + streak strip;
Learning Hub 8 volumes zero red alerts; Crack Time custom + validation + timer cycle; mocks
9 -> expander -> 25 logos all loading; avatar upload persistence; no horizontal overflow at
1920/1440/1024/768/430/390/360 on landing + dashboard; session persistence, logout, protected
route, re-login, duplicate-signup rejection.

### Gate results (final)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (3 workspaces) |
| `npm test` | PASS 42/42 (API 25 + web 17) |
| `npm run build` | PASS (api 147.32 KB ESM; web 542.29 KB JS / 129.60 KB CSS) |
| `npm run lint` | BLOCKED - no lint script exists in the project (documented) |
| Browser audit | PASS - 29/29 checks in a real headless Edge session |

### Remaining honest limitations

1. `npm run lint` has no script in this project - not claimed.
2. The audit's K2 signup-redirect check is exercised per run; when the signup rate limiter
   (10/h per IP) is exhausted by repeated audit runs, the driver continues from the stored
   account via login and marks K2 BLOCKED for that run (redirect itself verified PASS).
3. Checkpoint windows for boolean-algebra / programming-logic remain sequential slices of their
   approved pools (no invented questions); see Cycle G/H notes.
4. Browser audit runs headless at scripted viewport sizes; manual touch-device ergonomics (real
   finger targets on physical hardware) are approximated by the 360-430 px mobile sweep, not
   physically exercised.

---

## 10. 2026-11-11 finishing cycle (Cycle J): regression-driven QA against the user's own screenshots

Scope: investigate the four user-flagged live complaints (Settings "Failed to fetch", dashboard
goal/crack-time cards, practice empty-pool red error, company sections), fix root causes, and
re-run the gate set with fresh evidence. Full tables: [TEST_RESULTS.md Cycle J](TEST_RESULTS.md).

### What changed in this cycle

- **Settings network failure UX (Req 6/11 follow-up):** `ensureCsrf` now wraps its fetch errors
  into `ApiError(0)` exactly like every other call, and status 0 maps to the actionable message
  "Cannot reach the TitanApt server. The API may be starting up or restarting - wait a moment and
  try again." The raw browser text "Failed to fetch" can no longer reach the UI.
- **Practice pool honesty (Req 10 follow-up):** `/api/topics` and `/api/topics/:slug` now expose
  per-difficulty `difficultyCounts` (shared `TopicSummary` schema updated). The Practice form
  shows "N hard verified" in the topic dropdown, renders a calm empty-pool footnote instead of a
  red post-hoc error, disables Start, and shows the true pool in the summary. DB truth behind the
  user's complaint: time-and-work has 26 approved MEDIUM questions and zero HARD - no data was
  invented or re-classified.
- **Verified-as-correct (no change needed):** Today's Goal and streak counting (probe shows an
  answer immediately incrementing `dailyGoal.completed` and `streak.todayActivityCount`; the
  user's live dashboard shows 14/10 with real activity), Crack Time focus minutes (honest data),
  Progress streak strip (same authoritative `/api/dashboard` source), all 33 company names/logos
  (real data from the reference PDF), 5-level Boolean Algebra + Programming Logic paths, marquee,
  orbit, Learning Hub, mocks logos, login/signup security matrix.

### Gate results (this cycle)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (3 workspaces) |
| `npm test` | PASS 43/43 (API 26 + web 17) |
| `npm run build` | PASS (web 543.17 KB JS / 129.90 KB CSS) |
| HTTP probes | PASS - cycle-j 19/19, cycle-j-auth 9/9 (evidence in scripts/qa + TEST_RESULTS Cycle J) |
| Browser verification | PASS - 0 console errors across landing/dashboard/practice/progress/learning-hub/mocks/companies/settings/crack-time |
| `npm run lint` | BLOCKED - no lint script exists in the project (documented) |

### Honest limitations

1. Avatar upload was verified over HTTP (upload/serve/reject/delete + persistence via
   `/api/auth/me`) and in Cycle I's browser audit; this session deliberately did NOT re-upload in
   the browser because the live session belongs to the user's real account (would have replaced
   their avatar).
2. Accent re-colouring of the streak card was verified live in Cycle I (orange->green->orange
   restores exactly); this cycle re-checked the component reads `var(--accent)` (no hardcoded
   green) but did not repeat the live colour switch.
3. Signup rate limiter (10/h per IP) makes repeated UI signup sweeps rate-limited; registration
   logic verified via the HTTP matrix (409 duplicate, validation 400s) and prior UI audits.
