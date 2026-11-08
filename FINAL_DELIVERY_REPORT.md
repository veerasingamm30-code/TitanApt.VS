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
