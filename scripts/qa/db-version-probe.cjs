const { Client } = require('pg');
const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const dbUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1].replace(/^"|"$/g, '').trim();
const c = new Client({ connectionString: dbUrl });
(async () => {
  await c.connect();
  const v = await c.query('SELECT version()');
  console.log('server:', v.rows[0].version);
  const enums = await c.query(
    "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'LessonLevel' ORDER BY enumsortorder",
  );
  console.log('LessonLevel values:', enums.rows.map((r) => r.enumlabel).join(', '));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
