// One-off inspection: lessons.json shape + lessons-extra.json redundancy check.
const fs = require('fs');
const base = JSON.parse(fs.readFileSync('prisma/data/lessons.json', 'utf8'));
const baseList = Array.isArray(base) ? base : base.lessons;
console.log('top-level is array:', Array.isArray(base), 'key count:', Array.isArray(base) ? '-' : Object.keys(base).join(','));
console.log('base lessons:', baseList.length);
const baseSlugs = new Set(baseList.map((l) => l.slug));
const extra = JSON.parse(fs.readFileSync('prisma/data/lessons-extra.json', 'utf8'));
const extraList = Array.isArray(extra) ? extra : extra.lessons;
const missingInBase = extraList.filter((l) => !baseSlugs.has(l.slug));
console.log('extra lessons:', extraList.length, 'not already in base:', missingInBase.length);
const cmp = extraList.map((l) => {
  const b = baseList.find((x) => x.slug === l.slug);
  if (!b) return l.slug + ': ABSENT-IN-BASE';
  return l.slug + ': ' + (JSON.stringify(b) === JSON.stringify(l) ? 'IDENTICAL' : 'DIFFERS');
});
console.log(cmp.join('\n'));
// also list base levels/orders for one topic to confirm ordering convention
for (const slug of ['number-system', 'boolean-algebra', 'programming-logic']) {
  console.log(slug, baseList.filter((l) => l.topicSlug === slug).map((l) => l.order + ':' + l.level + ':' + l.slug).join(' | '));
}
