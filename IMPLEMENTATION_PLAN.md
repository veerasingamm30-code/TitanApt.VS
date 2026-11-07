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
