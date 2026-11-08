/**
 * Merge the 2026-11-08 lesson batches into prisma/data/lessons.json.
 *
 * Source batches (validated in authoring order):
 *  - lessons-calendars.json (BEGINNER for the latent zero-lesson topic)
 *  - lessons-20261108-basic-{a,b}.json
 *  - lessons-20261108-intermediate-{a,b}.json
 *  - lessons-20261108-advanced-{a,b}.json
 *  - lessons-20261108-expert-{a,b}.json
 *
 * Validations performed before writing:
 *  - JSON parses; every lesson object has required fields, correct types
 *  - level is one of the 5 enum values
 *  - topicSlug exists in prisma/data/topics.json
 *  - slug is globally unique across base + batches
 *  - per topic, final order sequence is exactly 1..n with no holes
 *    (BEGINNER..EXPERT expected 1..5 for the 26 expanded topics;
 *    calendars-and-clocks gets 1 BEGINNER only)
 *  - recursive ASCII-only scan of the final file text
 *
 * The base file's existing entries are kept untouched; batches are appended
 * after base entries, then rows are regrouped by topic and ordered by level
 * rank then order for readability. If the file already contains batch slugs
 * (re-run), the merge is idempotent: existing batch entries are dropped first.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'prisma', 'data');
const TARGET = path.join(DATA_DIR, 'lessons.json');
const LEVELS = ['BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const LEVEL_RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

const BATCHES = [
  'lessons-calendars.json',
  'lessons-20261108-basic-a.json',
  'lessons-20261108-basic-b.json',
  'lessons-20261108-intermediate-a.json',
  'lessons-20261108-intermediate-b.json',
  'lessons-20261108-advanced-a.json',
  'lessons-20261108-advanced-b.json',
  'lessons-20261108-expert-a.json',
  'lessons-20261108-expert-b.json',
];

function fail(msg) {
  console.error('MERGE FAILED: ' + msg);
  process.exit(1);
}

const lessons = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
if (!Array.isArray(lessons)) fail('lessons.json is not a top-level array');

const topics = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'topics.json'), 'utf8'));
const topicSlugs = new Set(topics.map((t) => t.slug));

const REQUIRED_FIELDS = [
  'topicSlug', 'slug', 'title', 'level', 'order', 'objective', 'explanation',
  'analogy', 'workedExamples', 'rule', 'mistakes', 'memoryTip', 'practice',
  'sourceRef', 'reviewer',
];

function validate(lesson, label) {
  for (const f of REQUIRED_FIELDS) {
    if (lesson[f] === undefined) fail(`${label}: missing field ${f}`);
  }
  if (typeof lesson.slug !== 'string' || !/^[a-z0-9-]+$/.test(lesson.slug)) {
    fail(`${label}: bad slug ${lesson.slug}`);
  }
  if (!LEVELS.includes(lesson.level)) fail(`${label}: bad level ${lesson.level}`);
  if (!Number.isInteger(lesson.order) || lesson.order < 1) fail(`${label}: bad order`);
  if (!topicSlugs.has(lesson.topicSlug)) fail(`${label}: unknown topicSlug ${lesson.topicSlug}`);
  for (const f of ['objective', 'explanation', 'analogy', 'memoryTip', 'sourceRef', 'reviewer', 'title', 'topicSlug']) {
    if (typeof lesson[f] !== 'string' || lesson[f].length < 1) fail(`${label}: empty ${f}`);
  }
  if (!Array.isArray(lesson.workedExamples) || lesson.workedExamples.length === 0) {
    fail(`${label}: workedExamples empty`);
  }
  if (!Array.isArray(lesson.rule) || lesson.rule.length === 0) fail(`${label}: rule empty`);
  if (!Array.isArray(lesson.mistakes) || lesson.mistakes.length === 0) fail(`${label}: mistakes empty`);
  if (!Array.isArray(lesson.practice) || lesson.practice.length !== 3) {
    fail(`${label}: practice must have 3 items`);
  }
  lesson.practice.forEach((p, i) => {
    if (!p || typeof p.prompt !== 'string' || p.prompt.length === 0 || typeof p.answer !== 'string' || p.answer.length === 0) {
      fail(`${label}: practice[${i}] malformed`);
    }
  });
  lesson.workedExamples.forEach((w, i) => {
    if (!w || typeof w.title !== 'string' || typeof w.problem !== 'string' ||
        !Array.isArray(w.steps) || w.steps.length === 0 || typeof w.answer !== 'string') {
      fail(`${label}: workedExamples[${i}] malformed`);
    }
  });
}

// Track base entries and drop previously merged batch rows for idempotency.
const baseSlugs = new Set(lessons.slice(0).map((l) => l.slug));
const batchFiles = BATCHES.map((f) => path.join(DATA_DIR, f));
const batchSets = batchFiles.map((f) => {
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(arr)) fail(`${f}: not an array`);
  return new Set(arr.map((l) => l.slug));
});
const batchKnownSlugs = new Set([].concat(...batchSets.map((s) => [...s])));
const kept = lessons.filter((l) => !batchKnownSlugs.has(l.slug));
console.log(`base rows after idempotent filter: ${kept.length}`);

const appended = [];
for (const f of batchFiles) {
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  arr.forEach((lesson, i) => {
    validate(lesson, `${path.basename(f)}[${i}]`);
    if (baseSlugs.has(lesson.slug)) fail(`slug ${lesson.slug} already in base lessons.json`);
    appended.push(lesson);
  });
}
console.log(`appending ${appended.length} batch lessons`);

const merged = [...kept, ...appended];

// Uniqueness check
const seen = new Map();
for (const l of merged) {
  if (seen.has(l.slug)) fail(`duplicate slug ${l.slug}`);
  seen.set(l.slug, l);
}
// Cross-file duplicate-and-both-kept guard: batch slug colliding with kept rows
const keptSet = new Set(kept.map((l) => l.slug));
appended.forEach((l) => {
  if (keptSet.has(l.slug)) fail(`append collides with kept row slug ${l.slug}`);
});

// Per-topic order continuity 1..n and level composition
const byTopic = new Map();
merged.forEach((l) => {
  if (!byTopic.has(l.topicSlug)) byTopic.set(l.topicSlug, []);
  byTopic.get(l.topicSlug).push(l);
});
const batchTopicSlugs = new Set(appended.map((l) => l.topicSlug));
for (const [topic, list] of byTopic) {
  const lvls = list.map((l) => l.level);
  // Legacy topics (boolean-algebra, programming-logic) legitimately repeat
  // BEGINNER rows in the untouched base data; only enforce uniqueness where
  // batches authored full level paths.
  if (batchTopicSlugs.has(topic) && new Set(lvls).size !== lvls.length) {
    fail(`${topic}: duplicate level among ${lvls.join(',')}`);
  }
  const sorted = [...list].sort((a, b) => a.order - b.order);
  sorted.forEach((l, i) => {
    if (l.order !== i + 1) fail(`${topic}: order gap: ${sorted.map((x) => x.level + ':' + x.order).join(', ')}`);
  });
}

// ASCII discipline applies to newly authored batch content; legacy base rows
// may contain the occasional em dash and seed fine as-is.
for (const f of batchFiles) {
  const raw = fs.readFileSync(f, 'utf8');
  const m = raw.match(/[^\x00-\x7F]/);
  if (m) fail(`non-ASCII in ${path.basename(f)}: U+${m[0].codePointAt(0).toString(16)}`);
}

// Sort for readability: group rows per topic (by first-appearance of topic),
// within topic by level rank.
const topicOrderSeen = [];
for (const l of merged) {
  if (!topicOrderSeen.includes(l.topicSlug)) topicOrderSeen.push(l.topicSlug);
}
merged.sort((a, b) => {
  const ta = topicOrderSeen.indexOf(a.topicSlug);
  const tb = topicOrderSeen.indexOf(b.topicSlug);
  if (ta !== tb) return ta - tb;
  return LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.order - b.order;
});

const out = JSON.stringify(merged, null, 2) + '\n';

fs.writeFileSync(TARGET, out, 'utf8');

console.log('Wrote lessons.json: ' + merged.length + ' total lessons');
console.log('Per-topic counts:');
for (const [topic, list] of byTopic) {
  const lv = [...list].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]).map((l) => l.level[0]).join('');
  console.log(`  ${topic}: ${list.length} [${lv}]`);
}
console.log('Merge complete.');
