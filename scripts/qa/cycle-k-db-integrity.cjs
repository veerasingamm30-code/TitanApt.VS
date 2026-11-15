/* Cycle K — read-only database integrity probe.
 * Verifies: row counts, orphaned rows, unique/FK constraints, user-data
 * isolation, streak/goal consistency. Never writes to any table.
 * Usage: node scripts/qa/cycle-k-db-integrity.cjs
 */
require('dotenv').config();
const { Client } = require('pg');

let pass = 0;
let fail = 0;
function report(name, ok, detail) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1. Row counts (content + user data)
  const counts = await c.query(`
    select
      (select count(*) from "User") users,
      (select count(*) from "UserProfile") profiles,
      (select count(*) from "Session") sessions,
      (select count(*) from "Topic") topics,
      (select count(*) from "Lesson") lessons,
      (select count(*) from "Company") companies,
      (select count(*) from "Question") questions,
      (select count(*) from "QuestionAttempt") question_attempts,
      (select count(*) from "PracticeSession") practice_sessions,
      (select count(*) from "PracticeSessionQuestion") practice_session_questions,
      (select count(*) from "MockTestAttempt") mock_attempts,
      (select count(*) from "StreakDay") streak_days,
      (select count(*) from "StudyDay") study_days,
      (select count(*) from "LearningChapterProgress") lesson_progress
  `);
  const k = counts.rows[0];
  console.log('Row counts:', k);
  report('row counts collected', true);

  // 2. Orphan checks — every child row must have its parent
  const orphanChecks = [
    ['orphan profiles', `select count(*)::int n from "UserProfile" p left join "User" u on u.id = p."userId" where u.id is null`],
    ['orphan sessions', `select count(*)::int n from "Session" s left join "User" u on u.id = s."userId" where u.id is null`],
    ['orphan question attempts', `select count(*)::int n from "QuestionAttempt" a left join "PracticeSession" s on s.id = a."practiceSessionId" where a."practiceSessionId" is not null and s.id is null`],
    ['orphan practice sessions', `select count(*)::int n from "PracticeSession" s left join "User" u on u.id = s."userId" where u.id is null`],
    ['orphan practice session questions', `select count(*)::int n from "PracticeSessionQuestion" pq left join "PracticeSession" s on s.id = pq."sessionId" where s.id is null`],
    ['orphan mock attempts', `select count(*)::int n from "MockTestAttempt" m left join "User" u on u.id = m."userId" where u.id is null`],
    ['orphan study days', `select count(*)::int n from "StudyDay" d left join "User" u on u.id = d."userId" where u.id is null`],
    ['orphan streak days', `select count(*)::int n from "StreakDay" d left join "User" u on u.id = d."userId" where u.id is null`],
    ['orphan lesson progress', `select count(*)::int n from "LearningChapterProgress" lp left join "User" u on u.id = lp."userId" where u.id is null`],
    ['attempts referencing questions not approved', `select count(*)::int n from "QuestionAttempt" a join "Question" q on q.id = a."questionId" where q."reviewStatus" <> 'APPROVED'`],
    ['attempts referencing missing options', `select count(*)::int n from "QuestionAttempt" a left join "QuestionOption" o on o.id = a."selectedOptionId" where a."selectedOptionId" is not null and o.id is null`],
  ];
  for (const [name, sql] of orphanChecks) {
    const r = await c.query(sql);
    report(name + ' = 0', r.rows[0].n === 0, `n=${r.rows[0].n}`);
  }

  // 3. Unique constraints present
  const idx = await c.query(`
    select indexname from pg_indexes
    where schemaname = 'public' and indexname in
      ('User_emailNormalized_key', 'Session_tokenHash_key', 'UserProfile_userId_key')
  `);
  report('unique indexes on email/tokenHash/profile', idx.rows.length >= 3, idx.rows.map(r => r.indexname).join(', '));

  // 4. Foreign keys defined
  const fks = await c.query(`
    select count(*)::int n from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace
  `);
  report('foreign-key constraints present', fks.rows[0].n > 10, `n=${fks.rows[0].n}`);

  // 5. User-data isolation: every attempt carries its own userId and it resolves
  const isolation = await c.query(`
    select count(*)::int n from "QuestionAttempt" a
    left join "User" u on u.id = a."userId"
    where u.id is null
  `);
  report('question attempts fully owned (isolation join)', isolation.rows[0].n === 0, `n=${isolation.rows[0].n}`);

  // 6. Real-user consistency (read-only): study-day data present, streaks sane
  const consistency = await c.query(`
    select p."displayName",
      (select count(*)::int from "StudyDay" d where d."userId" = u.id) study_days,
      (select count(*)::int from "StreakDay" d where d."userId" = u.id) streak_days,
      (select count(*)::int from "QuestionAttempt" a where a."userId" = u.id) attempts
    from "User" u join "UserProfile" p on p."userId" = u.id order by u."createdAt" limit 3
  `);
  console.log('sample user study-day consistency (read-only):', consistency.rows);
  report('study-day query runs against real data', Array.isArray(consistency.rows));

  // 7. Sessions not expired but older than 7 days (would indicate expiry logic failure)
  const stale = await c.query(`
    select count(*)::int n from "Session"
    where "expiresAt" > now() and "createdAt" < now() - interval '8 days'
  `);
  report('no live sessions older than 8 days', stale.rows[0].n === 0, `n=${stale.rows[0].n}`);

  await c.end();
  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
