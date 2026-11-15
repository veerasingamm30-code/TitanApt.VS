# CYCLE K TEST RESULTS — TitanApt (2026-11-12)

All results below were executed fresh in this cycle. Nothing is inherited from prior reports
without re-execution. Dev stack: embedded PostgreSQL :55432 + API :4000 + web :5173.

## 1. Required gates (executed 2026-11-12)

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | **PASS** — shared + api + web, no errors |
| Unit/integration tests | `npm test` | **PASS 43/43** (API 26 + web 17) |
| Production build | `npm run build` | **PASS** — web `index-DJ0UjqJ4.css` 131.30 kB (gzip 24.96 kB), `index-Dlmqa4FZ.js` 543.78 kB (gzip 152.21 kB); API bundle 149.87 KB |
| Lint | `npm run lint` | **NOT AVAILABLE** — no lint script exists in the project (not invented, not claimed) |
| Dependency audit | `npm audit --workspaces` | **Executed — 10 advisories** (2 critical, 5 high, 3 moderate), classified in CYCLE_K_SECURITY_REPORT §5; breaking fixes deferred to an approved upgrade cycle |

## 2. HTTP probes (fresh runs)

| Suite | Result |
|---|---|
| `scripts/qa/cycle-j-probe.mjs` (csrf, auth, profile, target persistence, avatar upload/serve/reject/delete, dashboard goal+streak increment, streakHistory, topics difficultyCounts, pool honesty 409/201) | **19/19 PASS** |
| `scripts/qa/cycle-j-auth-probe.mjs` (wrong password 401, empty/invalid 400, duplicate 409, protected 401, login 200, session, logout invalidation) | **9/9 PASS** |
| `scripts/qa/cycle-k-db-integrity.cjs` (new, read-only) | **17/17 PASS** — see CYCLE_K_DATABASE_REPORT |
| `/health/live` | **PASS** 200 |
| `/health/ready` | **PASS** 200 — DB connected, latencyMs ≈ 67–89, content counts correct |

## 3. K7 browser verification (dashboard hero card)

| Check | Result |
|---|---|
| Page loads, quote appears with exact text | PASS |
| Supporting paragraph appears with exact text | PASS |
| Orange accent on highlighted words (#ffb020 final) | PASS |
| Entrance + accent animations run (forced `no-preference`) | PASS (`next-quote-in` 0.7s observed running) |
| Reduced motion respected (emulated `reduce`) | PASS — animations `none`, accent applied immediately |
| Start lesson navigates to /app/lessons/:id | PASS (live click) |
| View topic navigates to /app/learn/number-system | PASS (live click) |
| Console errors during all K7 checks | **0** |
| Heading, description, buttons, green gradient, decorative circle unchanged | PASS |

## 4. Responsive verification (dashboard with K7 card, all 7 viewports)

Viewports: 360, 390, 430, 768, 1024, 1440, 1920.

| Metric | Result |
|---|---|
| Horizontal overflow (`scrollWidth − clientWidth`) | **0 at every viewport** |
| Quote visible and not clipped by the card | PASS at every viewport (geometry-checked) |
| Buttons present and visible | PASS |
| Quote font scaling (clamp) | 17.9px @360 → 27.5px @1440+ |
| Screenshots | captured at 360 / 768 / 1920 + desktop and mobile visual checks |

Note: two automated scrolled screenshots in this session showed a transient black band;
diagnosed as a screenshot/compositor artifact of `scrollIntoViewIfNeeded` (DOM geometry
probes and manual-scroll screenshots show correct rendering at the same scroll positions).
Not a product bug.

## 5. Performance observations (measured, K5)

| Observation | Measurement | Assessment |
|---|---|---|
| API latency (rejection path, unauthenticated) | 15–21 ms (dashboard/topics/companies) | Excellent |
| `/health/ready` (5 DB count queries) | 67–89 ms | Good |
| DB roundtrip in readiness check | 88.9 ms first call, lower after | Good |
| Production JS bundle | 543.78 kB (gzip 152.21 kB), single chunk | Acceptable for the scale; route-level code splitting noted as a future option (NOT changed — no unnecessary refactoring) |
| Production CSS | 131.30 kB (gzip 24.96 kB) | Acceptable; K7 added ~0.6 kB |
| Rendering | No duplicate API calls observed on dashboard load; loading states present | PASS |
| Memory leaks | No runaway growth indicators in the browser session across many navigations (0 errors, stable) | NOT TESTED under long-run soak (out of scope) |

## 6. Regression verification

- All app pages (learn/practice/mocks/companies/progress/settings/crack-time) render correct
  headings, 0 console errors, 0 overflow — PASS.
- API tests cover auth, admin authorization, practice flow, mock logic, metrics, PDF parser,
  learning volume indexing — PASS.
- Database: no schema change this cycle; 17/17 integrity; user data intact (see database report).
- Existing PDFs, company logos, lesson content: untouched and rendering.

## 7. Files modified in Cycle K

| File | Change |
|---|---|
| `apps/web/src/pages/DashboardPage.tsx` | K7 quote block added inside the hero card |
| `apps/web/src/styles.css` | K7 styles (.next-quote, animations, reduced-motion, 2 media queries) |
| `scripts/qa/cycle-k-db-integrity.cjs` | NEW — read-only DB integrity probe (17 checks) |
| `CYCLE_K_*.md` (6 files) | NEW — this cycle's reports |

No API source, schema, migration, seed or dependency files were modified.

## 8. Bugs discovered / fixed

- Cycle K: no new product bugs (two false-alarms investigated and dismissed — see
  CYCLE_K_FUNCTIONAL_QA_REPORT §11).
- Cycle J fixes re-verified: Settings network-failure message PASS; Practice pool honesty PASS.

## 9. Remaining issues / risks (transparent)

1. 10 dependency advisories (breaking upgrades deferred — security report §5).
2. No lint script in the project (NOT AVAILABLE).
3. No automated DB backup schedule in the current dev topology (deployment report).
4. All Cycle A–K work remains uncommitted in the working tree (owner decision).
5. Long-run soak/memory testing and real touch-device ergonomics not exercised this cycle.
