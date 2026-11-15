# CYCLE K DATABASE REPORT — TitanApt (2026-11-12)

Scope: database integrity, persistence, migration state, constraints, user-data isolation,
backup/recovery posture. **Zero destructive operations were run.** No schema changes were made
this cycle. No user data was modified (all probes read-only).

## 1. Connectivity and migration state

| Check | Result | Evidence |
|---|---|---|
| DB reachable | PASS | `/health/ready` → `database.connected: true, latencyMs ≈ 67–89` |
| Prisma migrate status | PASS | `npx prisma migrate status` → "Database schema is up to date!" (6 migrations, none pending) |
| Migration history | PASS | 20261025104433_init → 20261101130000_learning_chapter_progress → 20261101150000_profile_appearance → 20261103110000_study_streak_avatar → 20261107110000_allow_multiple_lessons_per_topic → 20261108090000_add_lesson_levels_basic_expert + migration_lock.toml |
| Checksum drift | none observed | status reports clean; `migrate dev` is intentionally not used in this environment (documented previously) |

## 2. Integrity probe (new: `scripts/qa/cycle-k-db-integrity.cjs`, read-only)

**Result: 17/17 PASS** against the live dev database.

Row counts (real data, unmodified):

| Table | Rows | Table | Rows |
|---|---|---|---|
| User | 73 | QuestionAttempt | 295 |
| UserProfile | 73 | PracticeSession | 88 |
| Session | 79 | PracticeSessionQuestion | 554 |
| Topic | 28 | MockTestAttempt | 30 |
| Lesson | 140 | StreakDay | 12 |
| Company | 33 | StudyDay | 15 |
| Question | 1700 | LearningChapterProgress | 62 |

Checks and results:
- Orphaned children = 0 for: profiles, sessions, question attempts (by `practiceSessionId`),
  practice sessions, practice-session questions, mock attempts, study days, streak days,
  chapter progress. PASS ×9.
- Attempts referencing non-APPROVED questions = 0. PASS.
- Attempts referencing a deleted option = 0. PASS.
- Unique indexes present: `User_emailNormalized_key`, `UserProfile_userId_key`,
  `Session_tokenHash_key`. PASS.
- Foreign-key constraints defined: 40. PASS.
- User-data isolation: every `QuestionAttempt` carries its own `userId` and resolves to a
  real user (0 unowned). PASS.
- Session hygiene: 0 live sessions older than 8 days (7-day expiry logic working). PASS.

## 3. Critical verification — user data intact

Verified via the row counts above plus live application reads:
- User accounts intact (73 users, including the owner's real account — read-only).
- Practice history intact (88 sessions / 554 session-questions / 295 attempts).
- Mock test history intact (30 attempts).
- Today's Goal + streak data intact (StudyDay / StreakDay rows present; the live dashboard
  shows the owner's real goal completion and streak day strip).
- Crack Time records intact (StudyDay minutes data; page renders real values).
- Profile information intact (73 profiles = 1:1 with users; avatar serving verified in the
  Cycle J probe re-run this cycle: upload/serve/reject/delete 201/200/400/200 PASS).
- Persistence across restarts: the dev stack was restarted several times during this cycle
  (port conflicts / OpenCode restarts); all counts and records survived every restart —
  PostgreSQL is file-backed at `.pgdata/` (:55432).

## 4. Transaction handling & connection management (code review)

- Signup creates user + profile inside `prisma.$transaction` (auth.ts) — atomic.
- Practice submission writes attempts + progress via Prisma transactions in the practice
  routes; integrity probe found 0 partially-written chains (orphan checks all zero), which is
  the observable proof the transactions hold under real data.
- Single shared Prisma client instance (`apps/api/src/prisma.js`), no per-request clients.

## 5. Backup & recovery posture

- Backup procedure exists: `scripts/tmp-db-backup.mjs` — full-table JSON dump via `pg`
  (schema + rows + sequence values) because the stripped embedded Postgres has no `pg_dump`;
  writes timestamped files to a configurable `BACKUP_DIR`.
- Recovery: restore script re-inserts from the dump (same script family); untested this cycle
  (restoring into the live dev DB would risk overwriting user data — deliberately not run).
- Retention: manual files only — no automated schedule, no offsite copy. **Production gap
  documented in CYCLE_K_DEPLOYMENT_READINESS.md** (managed Postgres with automated daily
  backups recommended).
- Migration rollback strategy: Prisma keeps full migration history; rollback = targeted
  `migrate resolve`/revert migration. No destructive rollback was executed.

## 6. Status summary

| Area | Status |
|---|---|
| Connectivity / migrations | PASS |
| Constraints & integrity | PASS (17/17) |
| User-data isolation | PASS |
| Persistence across restart | PASS |
| Backup procedure | PASS (manual, documented) |
| Automated backup schedule | BLOCKED — not part of the current embedded-dev topology; required before production (documented, requires owner approval) |
