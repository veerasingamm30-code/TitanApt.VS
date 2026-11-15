/* Ad-hoc DB probe: practice pool difficulty distribution. */
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const taw = await c.query(
    `select t.slug, q.difficulty, count(*)::int n
     from "Question" q join "Topic" t on t.id = q."topicId"
     where q."reviewStatus" = 'APPROVED' and q."correctOptionId" is not null and t.slug = 'time-and-work'
     group by t.slug, q.difficulty order by q.difficulty`,
  );
  console.log('time-and-work approved pool by difficulty:', taw.rows);

  const hard = await c.query(
    `select t.slug, q.difficulty, count(*)::int n
     from "Question" q join "Topic" t on t.id = q."topicId"
     where q."reviewStatus" = 'APPROVED' and q."correctOptionId" is not null and q.difficulty = 'HARD'
     group by t.slug, q.difficulty order by n desc`,
  );
  console.log('HARD approved pool by topic:', hard.rows);
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
