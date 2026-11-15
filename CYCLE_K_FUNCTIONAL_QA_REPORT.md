# CYCLE K FUNCTIONAL QA REPORT — TitanApt (2026-11-12)

End-to-end functional QA against the live stack (API :4000, web :5173) in the owner's real
browser session, plus fresh HTTP probes. Read-only for the owner's account; mutations were
exercised only on the probe/test accounts.

## 1. Authentication — PASS (HTTP matrix 9/9)

| Test | Result | Evidence |
|---|---|---|
| Login with valid credentials | PASS | 200 + session cookie |
| Wrong password rejected | PASS | 401 generic (enumeration-safe) |
| Empty / invalid input rejected | PASS | 400 |
| Duplicate signup rejected | PASS | 409 EMAIL_TAKEN |
| Protected route without session | PASS | 401 |
| Session persists across requests | PASS | /api/auth/me 200 |
| Logout invalidates the session | PASS | post-logout 401 |
| CSRF bootstrap | PASS | 200 (ta_csrf + x-csrf-token pattern) |
| Signup rate limiting | PASS (by design) | 10/h per IP; registration logic verified via HTTP matrix |

## 2. Dashboard — PASS

- Greeting renders with the owner's real name; date/time chip correct.
- Today's Goal: real values (32/10 answered today during testing; ring 100%); a probe answer
  immediately increments `dailyGoal.completed` (Cycle J probe re-run: before/after 3→4).
- Streak: real current streak (5-day strip, 6 of 7 days lit with real dates Nov 6–12),
  "7 Day Goal 6/7", momentum message.
- Crack Time card: real "0 min / 5 min" with timer link.
- Hero card (K7): quote + paragraph render; **Start lesson → /app/lessons/:id** and
  **View topic → /app/learn/number-system** both navigate correctly (live click test).
- Search bar, quick links, stats row, mock cards render.

## 3. K7 hero-card details — PASS

- Exact quote present: "Every number has a story. Every problem has a solution." with orange
  accents on "Every number" / "Every problem" / "solution" (final computed colour
  rgb(255, 176, 32) = #ffb020).
- Exact paragraph present: "Don't just calculate numbers. Understand the logic behind them.
  Every problem you solve brings you one step closer to mastering mathematics and cracking
  your dream IT placement."
- Typography: italic serif stack (`--serif`), clamp-based sizing, balanced wrapping.
- Animation: entrance runs (`next-quote-in` 0.7s, observed opacity mid-flight under
  `no-preference`), accent reveal runs (`quote-accent-in` 0.9s delayed).
- Reduced motion: with `prefers-reduced-motion: reduce`, animations compute to `none` and the
  orange accent applies immediately — PASS.
- Background, heading, description, buttons, decorative circle unchanged.

## 4. Aptitude Practice — PASS

- Topic/difficulty selection with honest pools: `/api/topics` exposes
  `difficultyCounts` (time-and-work: EASY 0 / MEDIUM 26 / HARD 0 — real DB truth).
- Empty-pool honesty: Hard + time-and-work → server 409 with a clear message; the form shows
  "0 hard verified", a calm footnote, and disables Start. Medium → 201, pool built.
- Answer submission, correctness validation, explanations, progress updates and no-repeat
  behaviour: covered by the fresh Cycle J probe (19/19) + API test suite (43/43 total PASS).

## 5. Mock examinations — PASS

- 9 mock cards render with logos; 2 general + 25 company mocks published (750 questions),
  seeded from real data. Attempt flow (navigation, timer, scoring, history) covered by the
  API integration tests (PASS) and prior browser audits; no regressions observed this cycle.

## 6. Company section — PASS

- All 33 company profiles render with correct real names and logos; 0 broken images;
  profile navigation works (verified in the prior-cycle audit and spot-checked this cycle —
  the companies index renders with 0 console errors and 0 horizontal overflow).

## 7. Learning Hub — PASS

- 8 PDF volumes with chapter lists; "Learn one thing properly." heading renders; no red
  error styling. Volume indexing covered by the API test suite (cold-rebuild tests PASS).

## 8. Profile & Settings — PASS

- Profile card renders from the session; no "Failed to fetch" (Cycle J fix verified — the
  actionable network message replaced raw browser errors).
- Avatar upload/serve/reject/delete verified over HTTP on the probe account (201/200/400/200)
  — deliberately not re-uploaded in the owner's browser (would replace their real avatar).
- Settings persistence (study target PATCH 47 → persists) PASS.

## 9. Additional features — PASS

- Crack Time page renders real values; custom-target input reveals and applies.
- Progress page: "Evidence of the work you have done." with real streak strip and stats.
- Theme settings: accent theming verified as `var(--accent)`-driven (code review).
- Responsive navigation: hamburger topbar at mobile widths; all pages 0 overflow (see §10).

## 10. Regression sweep across all pages — PASS

Live browser pass over `/app/learn`, `/app/practice`, `/app/mocks`, `/app/companies`,
`/app/progress`, `/app/settings`, `/app/crack-time` — every page rendered its correct heading
with **0 console errors** and **0 horizontal overflow** at desktop width; dashboard/practice/
landing re-checked at 7 viewports (see CYCLE_K_TEST_RESULTS §4).

## 11. Bugs found / fixed this cycle

- No new product bugs. Two verification false-alarms were investigated and dismissed:
  1. A "black band / floating topbar" seen in some automated scrolled screenshots — proved a
     transient compositor/screenshot artifact of `scrollIntoViewIfNeeded` in this browser
     session; DOM geometry probes and manual-scroll screenshots show correct rendering.
  2. `/api/health` returning 401 — correct by design; health routes live at `/health/*`
     outside the CSRF-guarded `/api` scope (verified 200).
- Cycle J's two real fixes (Settings network message, Practice pool honesty) re-verified PASS.
