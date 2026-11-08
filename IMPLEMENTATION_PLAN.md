# TitanApt — Implementation Plan (2026-11-06 upgrade)

Status vocabulary: PASS / PARTIAL / FAIL / BLOCKED. Final status marks live in TEST_RESULTS.md.

## Ordered workitems

| # | Item | Files | Gate |
|---|---|---|---|
| 1 | Fix dev API startup (root `.env` discovery) | `apps/api/src/env.ts` | API boots; login works over HTTP |
| 2 | Streak rule: ≥4 correct Practice answers per local calendar day (distinct questions, mocks/checkpoints excluded), attempt-derived, race-free | `apps/api/src/lib/metrics.ts`, `routes/dashboard.ts`, `routes/practice.ts` | Streak fields verified over HTTP with scripted answers |
| 3 | Learning Hub 8-volume fix: real PDF path resolution (Img-pdf fallbacks), resilient volume indexing, partial-failure tolerance | `packages/shared/src/learningVolumes.ts`, `apps/api/src/routes/learning.ts` | `GET /api/learning/volumes` returns 8 volumes with chapter lists |
| 4 | Learning Hub UX: chapter navigation (prev/next), embedded PDF viewer, per-volume error handling | `apps/web/src/pages/LearningHubPage.tsx` | Each volume opens; progress toggles report errors |
| 5 | Search API + Dashboard search bar (groups: topics, lessons, companies, mocks, volumes, subjects, navigation) with keyboard nav | `apps/api/src/routes/search.ts`, `apps/web/src/components/SearchBar.tsx`, `DashboardPage.tsx` | “Number” returns Number System/Series/Problems groups; arrows+Enter navigate |
| 6 | Streak chart UI (SVG bars, qualification threshold, weekly summary, today’s status) replacing chips/dots | `apps/web/src/components/StreakChart.tsx`, `DashboardPage.tsx`, `styles.css` | Chart renders from `streakHistory` API data |
| 7 | 3D company orbit with real logos (2 rings, upright logos, hover tooltip, click→company page, keyboard + touch, reduced-motion) | `apps/web/src/components/CompanyOrbit.tsx`, `DashboardPage.tsx`, `styles.css` | All 26 logos orbit; clicking opens `/app/companies/:slug` |
| 8 | Theme quick toggle in topbar (persisted to profile) | `AppShell.tsx`, `theme.ts` | Toggle flips dark↔light instantly; survives refresh and re-login |
| 9 | Mock Test upgrade: real logos on company cards (slug→logo mapping + initials fallback), category filter, configurable difficulty/question-count/duration for company mocks with pool validation | `MockPages.tsx`, `apps/api/src/routes/mock.ts` | Start with e.g. Easy/20/30 creates an attempt with 20 questions and 30-min deadline |
| 10 | Crack Time custom target: explicit Apply + Enter commit, validation, server error display, Dashboard shows study target | `CrackTimePage.tsx`, `routes/dashboard.tsx`, `DashboardPage.tsx` | Custom 35 min persists and drives progress % |
| 11 | Settings: avatar pre-upload preview, cache-busted replace | `SettingsPage.tsx`, `routes/auth.ts` | Replace updates immediately; remove works |
| 12 | Typography system: display/serif-italic/mono tokens with fallbacks and responsive sizes | `styles.css` | Headings/body/numbers distinct; no new dependencies |
| 13 | Full testing cycles (typecheck → tests → build → HTTP integration → browser) | — | Evidence in TEST_RESULTS.md |
| 14 | Docs refresh (audit/plan/results + README pointers) | `docs/*`, root docs | — |

## Constraints honored

- No new runtime dependencies (chart/orbit/search are hand-built SVG/CSS/React).
- No fake data: streak counts come from real attempts; search indexes live DB rows; mock pools from approved questions.
- Preserve existing features: page routes, seed behavior, admin workflow, Crack Time timer engine untouched except the custom-target commit path.

## Completion status (2026-11-07)

Items 1–12: all delivered — verification gates in [TEST_RESULTS.md](TEST_RESULTS.md),
fix details in [BUG_FIX_REPORT.md](BUG_FIX_REPORT.md).

Added workitems executed beyond the original list:

| # | Item | Files | Gate | Result |
|---|---|---|---|---|
| A1 | Lesson schema multilesson enablement (drop `@@unique([topicId, level])` → `@@index([topicId, order])`, migrate via `db:deploy` — no reset) | `prisma/schema.prisma`, new migration, `prisma/seed.ts` | Seed succeeds; lessonCount=3 for new topics | PASS |
| A2 | Author 3 Boolean Algebra + 3 Programming Logic lessons (WIN1252-safe encoding) | `prisma/data/lessons.json` | 31 lessons seeded; HTTP lesson detail per topic | PASS |
| A3 | Lesson prev/next sibling navigation | `apps/api/src/routes/content.ts`, `apps/web/src/pages/LearnPages.tsx` | siblings in lesson payload; `.lesson-sibling-nav` rendered | PASS |
| A4 | Public companies endpoint (pre-login, no user data) | `apps/api/src/routes/public.ts`, `app.ts` | 26 companies public; protected routes still 401 | PASS |
| A5 | Landing right-to-left company marquee | `apps/web/src/components/CompanyMarquee.tsx`, `marquee.css` | seamless loop, pause, reduced-motion, signed-in-safe mock CTA | PASS |
| A6 | Mock category row (server + client, completed after concurrent-editor draft repair; Question-subject grouping fixed to pool query) | `apps/api/src/routes/mock.ts`, `apps/web/src/pages/MockPages.tsx` | category probe 11/11; impossible config 409 | PASS |

## 2026-11-08 addendum: lesson-path expansion delivered

Ordered workitems all PASS as of 2026-11-07 (see TEST_RESULTS.md). New scope executed 2026-11-08:
- Expand all 25 single-lesson topics + calendars-and-clocks to 5-level paths; 105 lessons authored,
  merged, seeded (136 total). PASS per Cycle G in TEST_RESULTS.md.
- Migration `20261108090000_add_lesson_levels_basic_expert` applied; shared LESSON_LEVELS constant and
  web level chips extended to 5 values. PASS.
Remaining PARTIAL: boolean-algebra / programming-logic 3-lesson paths (legacy data kept).
