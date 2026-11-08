const { Client } = require('pg');
const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const dbUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1].replace(/^"|"$/g, '').trim();
const c = new Client({ connectionString: dbUrl });
(async () => {
  await c.connect();
  // 1) validate single-quoted AFTER syntax on a scratch type
  try {
    await c.query("CREATE TYPE qa_scratch_enum2 AS ENUM ('A')");
    await c.query("ALTER TYPE qa_scratch_enum2 ADD VALUE 'B' AFTER 'A'");
    console.log('OK   : single-quoted AFTER syntax');
  } catch (e) {
    console.log('ERROR: single-quoted AFTER syntax ->', e.message);
  } finally {
    await c.query('DROP TYPE IF EXISTS qa_scratch_enum2').catch(() => {});
  }
  // 2) remove the misplaced BASIC (appended at end by the probe) so migration can re-add it in order
  try {
    await c.query("ALTER TYPE \"LessonLevel\" DROP VALUE 'BASIC'");
    console.log('OK   : dropped misplaced BASIC');
  } catch (e) {
    console.log('ERROR: drop BASIC ->', e.message);
  }
  const enums = await c.query(
    "SELECT e.enumsortorder, e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'LessonLevel' ORDER BY 1",
  );
  console.log('LessonLevel now:', enums.rows.map((r) => r.enumlabel).join(', '));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
