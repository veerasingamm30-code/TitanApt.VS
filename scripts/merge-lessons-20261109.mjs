// Merge the 2026-11-09 five-level TECHNICAL lessons into prisma/data/lessons.json.
// - Adds the 4 new lessons (Boolean ADVANCED/EXPERT, Programming ADVANCED/EXPERT).
// - Relabels one existing lesson per topic BEGINNER -> BASIC so both topics run
//   BEGINNER, BASIC, INTERMEDIATE, ADVANCED, EXPERT in order 1..5.
// Gates: ASCII-only text, slug uniqueness, exact lesson schema keys, per-topic
// order continuity 1..N, and level ordering.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const lessonsPath = root + 'prisma/data/lessons.json';
const batchPath = root + 'prisma/data/lessons-tech-subjects-20261109.json';

const REQUIRED_KEYS = [
  'topicSlug', 'slug', 'title', 'level', 'order', 'objective', 'explanation', 'analogy',
  'workedExamples', 'rule', 'mistakes', 'memoryTip', 'practice', 'sourceRef', 'reviewer',
];
const LEVEL_ORDER = ['BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const RELABEL = {
  'boolean-algebra-truth-tables': 'BASIC',
  'programming-logic-variables-operators-conditions': 'BASIC',
};

function assertAscii(value, where) {
  if (typeof value === 'string') {
    if (!/^[\x20-\x7E\n\t]*$/.test(value)) throw new Error(`Non-ASCII text in ${where}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertAscii(item, `${where}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertAscii(item, `${where}.${key}`);
  }
}

const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const lessons = JSON.parse(readFileSync(lessonsPath, 'utf8'));
const before = lessons.length;

for (const lesson of batch) {
  const keys = Object.keys(lesson);
  const missing = REQUIRED_KEYS.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !REQUIRED_KEYS.includes(key));
  if (missing.length || extra.length) throw new Error(`Schema mismatch for ${lesson.slug}: missing=${missing} extra=${extra}`);
  if (lesson.level !== 'ADVANCED' && lesson.level !== 'EXPERT') throw new Error(`Unexpected level in batch: ${lesson.slug}`);
  assertAscii(lesson, lesson.slug);
  if (lessons.some((existing) => existing.slug === lesson.slug)) throw new Error(`Duplicate slug: ${lesson.slug}`);
  // sanity: every worked example must have steps and an answer
  for (const example of lesson.workedExamples) {
    if (!example.title || !example.problem || !Array.isArray(example.steps) || example.steps.length < 3 || !example.answer) {
      throw new Error(`Incomplete example in ${lesson.slug}: ${example.title}`);
    }
  }
  if (lesson.practice.length !== 3 || lesson.rule.length !== 4 || lesson.mistakes.length !== 3) {
    throw new Error(`Wrong section sizes in ${lesson.slug}`);
  }
}

for (const [slug, level] of Object.entries(RELABEL)) {
  const lesson = lessons.find((entry) => entry.slug === slug);
  if (!lesson) throw new Error(`Relabel target missing: ${slug}`);
  if (lesson.level !== 'BEGINNER') throw new Error(`Relabel target not BEGINNER: ${slug} is ${lesson.level}`);
  lesson.level = level;
}

lessons.push(...batch);

// per-topic validation: levels in order, orders 1..N exactly once, sorted by order
const byTopic = new Map();
for (const lesson of lessons) {
  if (!byTopic.has(lesson.topicSlug)) byTopic.set(lesson.topicSlug, []);
  byTopic.get(lesson.topicSlug).push(lesson);
}
for (const [topic, list] of byTopic) {
  const sorted = [...list].sort((a, b) => a.order - b.order);
  sorted.forEach((lesson, index) => {
    if (lesson.order !== index + 1) throw new Error(`Order gap in ${topic}: ${lesson.slug} has order ${lesson.order}, expected ${index + 1}`);
  });
  const levels = sorted.map((lesson) => lesson.level);
  const uniqueLevels = [...new Set(levels)];
  const expected = uniqueLevels.length === 5 ? LEVEL_ORDER : uniqueLevels;
  if (JSON.stringify(uniqueLevels) !== JSON.stringify(expected)) {
    throw new Error(`Level sequence wrong in ${topic}: ${uniqueLevels.join(',')}`);
  }
}

writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2) + '\n');
console.log(`Merged 4 lessons: ${before} -> ${lessons.length}`);
for (const topic of ['boolean-algebra', 'programming-logic']) {
  console.log(topic, byTopic.get(topic).sort((a, b) => a.order - b.order).map((lesson) => `${lesson.order}:${lesson.level}`).join(' '));
}
