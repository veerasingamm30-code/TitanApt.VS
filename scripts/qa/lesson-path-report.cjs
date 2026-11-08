// QA probe: per-topic lesson path report + checkpoint completeness.
// Usage: node scripts/qa/lesson-path-report.cjs
const fs = require('fs');
const { Client } = require('pg');

const envText = fs.readFileSync('.env', 'utf8');
const dbUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1].replace(/^"|"$/g, '').trim();
const c = new Client({ connectionString: dbUrl });

(async () => {
  await c.connect();
  const topics = (await c.query('SELECT id, slug FROM "Topic" ORDER BY slug')).rows;
  let full = 0;
  const issues = [];
  for (const t of topics) {
    const ls = (await c.query(
      'SELECT id, level, "order" FROM "Lesson" WHERE "topicId" = $1 ORDER BY "order"',
      [t.id],
    )).rows;
    const lv = ls.map((l) => l.level[0] + l.order).join(',');
    if (ls.length === 5 && lv === 'B1,B2,I3,A4,E5') full++;
    else console.log('  partial: ' + t.slug + ' -> ' + ls.map((l) => l.level + ':' + l.order).join(', '));
    if (!ls.every((l, i) => l.order === i + 1)) issues.push(t.slug + ' order gap: ' + lv);
    const missing = (await c.query(
      'SELECT count(*)::int FROM "Lesson" l WHERE "topicId" = $1 AND NOT EXISTS (SELECT 1 FROM "LessonCheckpoint" cp WHERE cp."lessonId" = l.id)',
      [t.id],
    )).rows[0].count;
    if (missing > 0) issues.push(t.slug + ': ' + missing + ' lessons without checkpoints');
  }
  console.log('topics with full 5-level path (B1,B2,I3,A4,E5): ' + full + ' / ' + topics.length);
  console.log('issues: ' + (issues.length ? issues.join(' | ') : 'none'));
  console.log('total checkpoints: ' + (await c.query('SELECT count(*)::int AS n FROM "LessonCheckpoint"')).rows[0].n);
  // New EXPERT lessons sample: confirm present with checkpoints
  const sample = (await c.query(
    "SELECT l.slug, count(cp.id)::int AS cps FROM \"Lesson\" l LEFT JOIN \"LessonCheckpoint\" cp ON cp.\"lessonId\" = l.id WHERE l.level = 'EXPERT' GROUP BY l.slug ORDER BY l.slug LIMIT 5",
  )).rows;
  console.log('EXPERT sample (slug, checkpoint count): ' + sample.map((r) => r.slug + '=' + r.cps).join(', '));
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
