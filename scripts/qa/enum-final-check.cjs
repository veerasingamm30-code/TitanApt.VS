const { Client } = require('pg');
const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const dbUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1].replace(/^"|"$/g, '').trim();
const c = new Client({ connectionString: dbUrl });
(async () => {
  await c.connect();
  const enums = await c.query(
    "SELECT e.enumsortorder, e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'LessonLevel' ORDER BY 1",
  );
  console.log('LessonLevel:', enums.rows.map((r) => r.enumlabel).join(', '));
  const levels = await c.query("SELECT level, count(*) FROM \"Lesson\" GROUP BY level ORDER BY 2");
  console.log('Lesson rows by level:', levels.rows.map((r) => r.level + '=' + r.count).join(', '));
  // confirm the old type is gone and no stray LessonLevelNew remains
  const types = await c.query(
    "SELECT typname FROM pg_type WHERE typname IN ('LessonLevel', 'LessonLevelNew') AND typtype='e'",
  );
  console.log('enum types present:', types.rows.map((r) => r.typname).join(', '));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
