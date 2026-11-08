# TitanApt — Upgrade Audit (Phase 1)

Date: 2026-11-06 · Project: `E:\VEERASINGAM\TitanApt.VS` (user-confirmed active copy)

## 1. Architecture (verified)

| Layer | Technology |
|---|---|
| Web | React 19 + React Router 7 + Vite 6 + TypeScript (`apps/web`) |
| API | Express 4 + TypeScript + Zod + Helmet + rate limiting (`apps/api`) |
| Shared | `packages/shared` (Zod schemas, types, learning-volume metadata) |
| DB | PostgreSQL 17 (embedded-postgres, port 55432) + Prisma 6 (`prisma/`) |
| Auth | Argon2id hashes, SHA-256 session tokens, HttpOnly cookies, double-submit CSRF |
| Tests | Vitest + Supertest (API), Testing Library (web) |
| Seed | 28 topics, 25 lessons, 26 companies, 1675 approved questions, 27 published mocks |

## 2. Reference assets found

`Img&pdf` (spelled `Img-pdf` in the workspace) at the project root contains:

| Asset | Status |
|---|---|
| `Volume 1.pdf` … `Volume 8.pdf` | Byte-identical copies already bundled at `apps/web/public/resources/volume-1..8.pdf` (sizes match; hashes recorded in docs/PROJECT_AUDIT.md). Content used for Learning Hub chapter indices + linked PDF viewer. |
| `IT Company Logo.png` | Single sprite/collage image. Per-company logos were previously extracted into `apps/web/public/company-logos/*.png` — 26 of 26 seeded companies have a matching PNG file on disk (verified: zero slug mismatches). |
| `MOCK TEST.pdf.pdf` | Top25 company-style mock source; seeded as 25 `company-mock-*` MockTests (30 questions each, 750 questions total, companyTags = company name). |

No expected asset is missing.

## 3. Requirement-by-requirement state found (before this upgrade)

| # | Requirement | State found | Evidence |
|---|---|---|---|
| 1 | Theme switcher (Dashboard, bright/dark, persisted) | PARTIAL — works in Settings only; `data-theme`/`data-accent` tokens exist; persisted to profile + localStorage | `apps/web/src/pages/SettingsPage.tsx`, `lib/theme.ts` |
| 2 | Dashboard search bar | FAIL — no global search; only per-page filters | AppShell/DashboardPage |
| 3 | Practice streak chart (4 correct/day rule) | FAIL — Server used “any activity” streak (1 answered question / checkpoint / mock); streak `.streak-history` rendered as date chips, not a chart | `apps/api/src/routes/dashboard.ts:196`, `lib/metrics.ts:62-86` |
| 4 | 3D radial company orbit | FAIL — scroll-snap “coverflow” strip, no 3D | `DashboardPage.tsx:182-193` |
| 5 | Company logos in Mock Tests | FAIL — company mock cards rendered a generic Building2 icon and a “no real company logo is used” notice despite logos existing on disk | `MockPages.tsx:81,121` |
| 6 | Crack Time custom target | PARTIAL — Custom option exists and saves via `PATCH /api/study/target` (5–480 min, persisted on profile), but saves only on blur, no explicit confirm, no error display, and Dashboard never shows the study target | `CrackTimePage.tsx:242-248` |
| 7 | Learning Hub (8 volumes) | FAIL — root cause found: server resolves PDF outlines from `Aptitude/Learning Hub.pdf/<file>` which does not exist in this workspace → `ENOENT` → 500 → UI shows “Something went wrong. Please try again.” Browser-side `resourceUrl` copies existed all along | `apps/api/src/routes/learning.ts:167`, `packages/shared/src/learningVolumes.ts` |
| 8 | Profile editing + avatar upload | PASS (verified code) — raw upload with magic-byte validation (`image/png|jpeg|webp|gif`), delete, 4 MB cap, stored under `uploads/avatars/<userId>`, propagated to topbar; missing: pre-upload preview, cache-bust on replace | `apps/api/src/routes/auth.ts:51-127` |
| 9 | Mock/Test + Topic lesson selection UX | PARTIAL — Practice selection is fully wired (subject/topic/difficulty/count/time → session); Mock selection had no difficulty/count/duration controls (fixed 30Q/30min) and logo-less cards | `MockPages.tsx` |
| 10 | Typography | PARTIAL — only `--sans`/`--serif` tokens; no display/mono/italic system | `styles.css:30-31` |
| 11 | Responsive design | PASS (code-verified) — hamburger + off-canvas sidebar, 7 breakpoints, reduced-motion block; needs visual verification |
| 12 | Data quality / server reliability | FAIL (build-breaking) — **API died on startup in dev**: `npm run dev -w @titanapt/api` runs with cwd `apps/api`, so `dotenv/config` never found the root `.env` → “Invalid environment configuration: DATABASE_URL: Required” → every login/selector hit ECONNREFUSED. DB constraints are otherwise solid (unique keys on attempts, streak days, chapter progress, session tokens) |
| 13 | Scope control | n/a — followed |
| 14/15 | Testing cycles + real account | To be executed after implementation |

## 4. Bugs discovered (pre-implementation)

1. **(Blocker)** API startup env failure (see #12) — nobody could sign in from the dev server.
2. Learning Hub 500: wrong PDF source path in `learning.ts` (+ brittle: page-count mismatch hard-throws; volume-2 index scan slow on cold start).
3. Practice streak counted incorrect answers, mock activity and repeated submissions.
4. Company-mock cards had no logo mapping (`company-mock-<slug>` → `/company-logos/<slug>.png` was derivable but unused) and no onError fallback in the coverflow.
5. `CrackTimePage.commitTarget()` had no `catch` — failures invisible to the user.
6. Dashboard payload had dead fields (`focusTopics`, `availableMocks`).

## 5. Decision

Work in place, minimal-scope: fix root causes (env bootstrap, learning path resolution, streak rule), add the missing UI (search, streak chart, orbit, mock config, theme toggle), reuse existing components (CompanyMark, useApi, ui primitives), add zero runtime dependencies.

## 6. Post-upgrade completion addendum (2026-11-07)

All items above were remediated in place; per-item root causes and verification live in
[BUG_FIX_REPORT.md](BUG_FIX_REPORT.md) and [TEST_RESULTS.md](TEST_RESULTS.md).

- §1 architecture unchanged; seed totals upgraded to **28 topics · 31 lessons · 26 companies · 1,675 approved + 25 pending questions · 27 mocks** (was 25 lessons).
- §3 items 1–10: theme toggle, dashboard search, streak chart, 3D orbit, company mock logos, Crack Time Apply flow, Learning Hub volumes, avatar preview + cache-bust, mock config UI/UX, typography — all delivered and verified (HTTP probes + Playwright Cycles D–F).
- §4 bugs 1–6: all FIXED (see BUG_FIX_REPORT.md #1–#7); search-tuple crash found during testing also FIXED (#8).
- New scope in this cycle: Lesson schema multilesson constraint dropped (Boolean Algebra / Programming Logic lesson sets, 6 lessons authored, siblings nav); public companies endpoint + landing marquee; mock category feature (completed collaboratively while another editor was concurrently modifying the same files — corrupted draft repaired, `Question.subject` groupBy replaced with a valid pool query).
- Honest count provenance: Top25 PDF yields 25 companies; DB's 26th is Zoho from the companies guide; none invented.
- Data preservation: no resets; migrations via `npm run db:deploy` because `prisma migrate dev` hits checksum drift and demands a reset; all pre-existing users intact.
