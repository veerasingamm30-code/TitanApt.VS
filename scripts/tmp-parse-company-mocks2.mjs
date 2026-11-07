// Parser: Img-pdf "MOCK TEST.pdf.pdf" x-position aware text -> structured mock tests
// Output: E:/VEERASINGAM/TitanApt.VS/prisma/data/company-mocks.json
import fs from 'node:fs';
import crypto from 'node:crypto';

const SRC = process.env.PARSE_SRC || 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt/mock-test-xy.txt';
const OUT = 'E:/VEERASINGAM/TitanApt.VS/prisma/data/company-mocks.json';

// ---------- load pages ----------
const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);
const pages = [];
let curPage = null;
for (const line of lines) {
  const pm = line.match(/^===== PAGE (\d+) =====$/);
  if (pm) {
    if (curPage) pages.push(curPage);
    curPage = { page: Number(pm[1]), rows: [] };
    continue;
  }
  if (!curPage) continue;
  const xm = line.match(/^@([\d.]+)\| ?(.*)$/);
  if (!xm) continue;
  curPage.rows.push({ x: Number(xm[1]), text: xm[2], page: curPage.page });
}
if (curPage) pages.push(curPage);

// footer removal
for (const p of pages) {
  p.rows = p.rows.filter((r) => !/TitanApt \| Top 25 Indian IT Companies \| Company-Style Mock Tests/.test(r.text) && !(r.page > 1 && /^Page \d+$/.test(r.text.trim())));
}
const flat = [];
for (const p of pages) for (const r of p.rows) flat.push(r);
console.log('rows:', flat.length);

// ---------- locate companies ----------
const companies = [];
for (let i = 0; i < flat.length - 1; i++) {
  const m = flat[i].text.match(/^(\d{2})\. (.+)$/);
  if (m && flat[i + 1].text.startsWith('Practice emphasis')) {
    companies.push({ index: Number(m[1]), name: m[2].trim(), start: i });
  }
}
console.log('companies:', companies.length);

const stemLabelBreak = /^(Statements|Conclusions|Which option is correct|Given|Options)\b/;
const listMarker = /^(\d+\.\s|I\.\s|II\.\s|III\.\s|- )/;
const qHeaderA = /^Q(\d+)\. (.+) \| (Easy|Medium|Hard|Beginner)$/;
const optionLine = /^\(([A-H])\)\s*(.*)$/;
const letterPara = /^([A-H])\. (.+)$/;

const BODY = 45.4;
const BULLET = 50.4;
const CODE_BASE = 53.4;
const CODE_STEP = 20.4;
const OPTION_X = 57.4;

function stemLine(prev, row, lastWasCode) {
  // returns continuation strategy per x
  if (row.x >= CODE_BASE - 0.5) {
    const level = Math.max(0, Math.round((row.x - CODE_BASE) / CODE_STEP));
    const pad = level > 0 ? '    '.repeat(level) : '';
    return { text: (prev ? prev + '\n' : '') + pad + row.text, code: true };
  }
  if (Math.abs(row.x - BULLET) < 1) return { text: (prev ? prev + '\n' : '') + row.text, code: false };
  // body text at BODY: wrap join unless list marker or previous line ends with ':' or previous was code
  if (!prev) return { text: row.text, code: false };
  if (lastWasCode || listMarker.test(row.text) || stemLabelBreak.test(row.text) || /:\s*$/.test(prev)) return { text: prev + '\n' + row.text, code: false };
  return { text: prev + ' ' + row.text, code: false };
}

function cleanAfterLabel(text, labelSentence) {
  let t = text.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim();
  if (t.startsWith(labelSentence)) t = t.slice(labelSentence.length).trim();
  return t;
}

// ---------- parse ----------
const mocks = [];
for (let ci = 0; ci < companies.length; ci++) {
  const c = companies[ci];
  const end = ci + 1 < companies.length ? companies[ci + 1].start : flat.length;
  const block = flat.slice(c.start, end);
  const companyName = c.name;

  const partA = block.findIndex((r) => r.text.startsWith('Part A - Questions'));
  const keyA = block.findIndex((r) => r.text.startsWith('Answer Key -'));
  const partB = block.findIndex((r) => r.text.startsWith('Part B - Answers and ELI10'));
  if (partA < 0 || keyA < 0 || partB < 0) { console.error('MARKER MISSING for', companyName); continue; }

  // ---- Part A questions ----
  const questions = [];
  let section = null;
  let q = null;
  for (let i = partA; i < keyA; i++) {
    const row = block[i];
    const sec = row.text.match(/^Section: (.+)$/);
    if (sec && Math.abs(row.x - BODY) < 2) { section = sec[1].trim(); continue; }
    const qm = row.text.match(qHeaderA);
    if (qm && Math.abs(row.x - BODY) < 2) {
      if (q) questions.push(q);
      q = { num: Number(qm[1]), topic: qm[2].trim(), difficulty: qm[3], section, page: row.page, stem: '', options: [] };
      continue;
    }
    if (!q) continue;
    if (Math.abs(row.x - OPTION_X) < 1) {
      const om = row.text.match(optionLine);
      if (om) q.options.push({ label: om[1], text: om[2] });
      continue;
    }
    if (Math.abs(row.x - 59.4) < 1 && q.options.length) {
      q.options[q.options.length - 1].text += ' ' + row.text;
      continue;
    }
    // stem line
    const s = stemLine(q.stem, row, q._lastWasCode === true);
    q.stem = s.text;
    q._lastWasCode = s.code;
  }
  if (q) questions.push(q);

  // ---- Part B explanations ----
  const explan = new Map();
  let curQn = null;
  let letter = null;
  let para = '';
  let bullets = [];
  const flushPara = () => {
    if (curQn == null || letter == null) return;
    const text = [para, ...bullets].filter(Boolean).join('\n');
    // store by first letter occurrence: use map keyed `n:letter` but letters may repeat? one per section
    const e = explan.get(curQn) || {};
    e[letter] = text;
    explan.set(curQn, e);
    para = ''; bullets = [];
  };
  for (let i = partB; i < block.length; i++) {
    const row = block[i];
    const hm = row.text.match(/^Q(\d+)\. .+\| Answer: \(([A-H])\)(?:\s(.*))?$/);
    if (hm && Math.abs(row.x - BODY) < 2) {
      flushPara();
      curQn = Number(hm[1]);
      explan.set(curQn, { answerLabel: hm[2], answerText: hm[3] || '', page: row.page });
      letter = null; para = ''; bullets = [];
      continue;
    }
    if (curQn == null) continue;
    if (Math.abs(row.x - BODY) < 2) {
      const lm = row.text.match(letterPara);
      if (lm && 'ABCDEFGH'.includes(lm[1])) {
        flushPara();
        letter = lm[1];
        para = lm[2];
        continue;
      }
      // plain body continuation of current letter paragraph
      if (letter) {
        if (/^\d+\.\s/.test(row.text) || /^-\s/.test(row.text)) bullets.push(row.text);
        else para += (para.endsWith(':') ? '\n' : ' ') + row.text;
      } else {
        // stray continuation of answer text
        const e = explan.get(curQn);
        if (e && !e._ansTouched) { e.answerText = ((e.answerText || '') + ' ' + row.text).trim(); e._ansTouched = true; }
      }
      continue;
    }
    if (Math.abs(row.x - BULLET) < 1) {
      if (letter) bullets.push(row.text);
      else { const e = explan.get(curQn); if (e && !e._ansTouched) { e.answerText = ((e.answerText || '') + ' ' + row.text).trim(); e._ansTouched = true; } }
      continue;
    }
    if (row.x >= 52.5) {
      // explanation body continuation lines (real x=53.4 in the PDF)
      if (letter) para += ' ' + row.text;
      else { const e = explan.get(curQn); if (e) e.answerText = ((e.answerText || '') + ' ' + row.text).trim(); }
      continue;
    }
    if (Math.abs(row.x - 59.4) < 1.5) {
      if (letter && bullets.length) bullets[bullets.length - 1] += ' ' + row.text;
      else if (letter) para += ' ' + row.text;
      else { const e = explan.get(curQn); if (e) e.answerText = ((e.answerText || '') + ' ' + row.text).trim(); }
    }
  }
  flushPara();

  // ---- merge ----
  const items = [];
  for (const qq of questions) {
    const e = explan.get(qq.num) || {};
    const answerLabel = e.answerLabel || qq.answerLabel;
    const explanation = cleanAfterLabel(e.E || '', 'Why is this answer correct?');
    const remember = cleanAfterLabel(e.H || '', 'Remember this');
    const reasoning = cleanAfterLabel(e.C || '', 'Which idea or formula should we use?');
    const shortcut = cleanAfterLabel(e.G || '', 'Is there a shortcut or alternative method?');
    const stepsRaw = e.D || '';
    const steps = stepsRaw.split('\n').filter((s) => /^\d+\.\s/.test(s.trim())).map((s) => {
      const m = s.match(/^\d+\.\s+(.*)$/);
      return m ? m[1].trim() : s.trim();
    });
    items.push({
      num: qq.num,
      topicLabel: qq.topic,
      difficulty: qq.difficulty,
      section: qq.section,
      page: qq.page,
      stem: qq.stem,
      options: qq.options,
      correctLabel: answerLabel,
      answerText: ((e.answerText || '')).trim() || '',
      explanation: (explanation + (remember ? ' ' + remember : '')).trim(),
      reasoning,
      steps,
      shortcuts: shortcut,
      asking: (e.A || '').replace(/^What is the question asking\?\s*/, '').trim(),
      known: (e.B || '').replace(/^What do we know\?\s*/, '').trim(),
      formula: reasoning,
    });
  }
  mocks.push({ index: c.index, companyName, sectionsLine: (block.find((r) => r.text.startsWith('Sections: ')) || { text: '' }).text.replace(/^Sections:\s*/, ''), emphasis: (block.find((r) => r.text.startsWith('Practice emphasis')) || { text: '' }).text.replace(/^Practice emphasis \(our own choice, not an official pattern\):\s*/, ''), difficultyMix: (block.find((r) => r.text.startsWith('Difficulty mix:')) || { text: '' }).text.replace(/^Difficulty mix:\s*/, ''), questions: items });
}

// ---------- validate ----------
let total = 0, missingOpts = 0, missingAns = 0, missingExpl = 0, missingSteps = 0;
for (const m of mocks) {
  if (m.questions.length !== 30) console.error(`WARN ${m.index} ${m.companyName}: ${m.questions.length} questions`);
  for (const q of m.questions) {
    total += 1;
    if (!q.options.length) missingOpts += 1;
    if (!q.correctLabel) missingAns += 1;
    if (!q.explanation) missingExpl += 1;
    if (!q.steps.length) missingSteps += 1;
  }
}
console.log({ total, missingOpts, missingAns, missingExpl, missingSteps });

fs.writeFileSync('C:/Users/acer/AppData/Local/Temp/opencode/titanapt/company-mocks-parsed2.json', JSON.stringify({ mocks }, null, 1), 'utf8');
console.log('parsed2 written');

// ---------- convert to seed JSON ----------
const topics = JSON.parse(fs.readFileSync('E:/VEERASINGAM/TitanApt.VS/prisma/data/topics.json', 'utf8'));
const dbCompanies = JSON.parse(fs.readFileSync('E:/VEERASINGAM/TitanApt.VS/prisma/data/companies.json', 'utf8'));
const existingQuestions = [
  ...JSON.parse(fs.readFileSync('E:/VEERASINGAM/TitanApt.VS/prisma/data/questions.json', 'utf8')),
  ...JSON.parse(fs.readFileSync('E:/VEERASINGAM/TitanApt.VS/prisma/data/top25-questions.json', 'utf8')),
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const EXTRA = {
  tataelxsi: 'tata-elxsi', redington: 'redington', intellectdesignarena: 'intellect-design-arena',
  newgensoftware: 'newgen-software', nucleussoftware: 'nucleus-software',
  happiestmindstechnologies: 'happiest-minds-technologies', saskentechnologies: 'sasken-technologies',
};
const byNormName = new Map(dbCompanies.map((c) => [norm(c.name), c.slug]));
const companySlug = (name) => byNormName.get(norm(name)) || EXTRA[norm(name)] || norm(name);

const TOPIC_MAP = {
  'ages': 'algebra', 'algebra': 'algebra', 'inequalities': 'algebra', 'quadratics': 'algebra',
  'simultaneous equations': 'algebra', 'logarithms': 'algebra',
  'averages': 'average', 'expected value': 'probability', 'descriptive statistics': 'probability',
  'estimation': 'percentages',
  'boats and streams': 'time-speed-distance', 'speed and distance': 'time-speed-distance', 'trains': 'time-speed-distance',
  'boolean algebra': 'boolean-algebra',
  'c: bitwise': 'programming-logic', 'c: operators': 'programming-logic', 'c: pointers': 'programming-logic',
  'c: recursion': 'programming-logic', 'c: switch': 'programming-logic', 'c: while loops and digits': 'programming-logic',
  'code output prediction': 'programming-logic', 'data representation': 'programming-logic', 'number systems': 'number-system',
  'calendars': 'calendars-and-clocks', 'clocks': 'calendars-and-clocks',
  'coding and decoding': 'coding-and-decoding', 'combinations': 'permutation-and-combination',
  'probability: dice': 'probability', 'probability: selection': 'probability', 'set theory': 'permutation-and-combination',
  'numeracy in arguments': 'statement-and-conclusion', 'evidence evaluation': 'statement-and-conclusion',
  'directions': 'direction-sense', 'divisibility': 'number-system', 'number theory': 'number-system',
  'grammar: agreement': 'grammar-and-usage', 'grammar: prepositions': 'grammar-and-usage',
  'hcf and lcm': 'number-system', 'interest': 'simple-and-compound-interest', 'mixtures': 'mixtures-alligation',
  'percentages': 'percentages', 'pie chart percentages': 'data-interpretation', 'tables and data reading': 'data-interpretation',
  'geometry and mensuration': 'geometry-and-mensuration',
  'pipes and cisterns': 'time-and-work', 'profit and loss': 'profit-and-loss', 'ratios': 'ratio-and-proportion',
  'sequences and series': 'progressions', 'syllogisms and deductions': 'syllogism', 'work': 'time-and-work',
};
const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

const fingerprint = (stem, options, correctLabel) => {
  const n = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(`${n(stem)} | ${options.map((o) => `${o.label.trim()}) ${n(o.text)}`).join(' | ')} | ${correctLabel}`).digest('hex');
};

const outMocks = [];
const unknownTopics = new Set();
for (const m of mocks) {
  const slug = companySlug(m.companyName);
  const questions = [];
  for (const q of m.questions) {
    const topicSlug = TOPIC_MAP[q.topicLabel.toLowerCase()];
    if (!topicSlug) { unknownTopics.add(q.topicLabel); continue; }
    const topic = topicBySlug.get(topicSlug);
    const difficulty = q.difficulty.toLowerCase() === 'beginner' ? 'EASY' : q.difficulty.toUpperCase();
    questions.push({
      topicSlug,
      subject: topic.subject,
      sectionName: q.section || '',
      stem: q.stem,
      statement: q.topicLabel,
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
      correctLabel: q.correctLabel,
      answerText: q.answerText,
      explanation: q.explanation,
      reasoning: q.reasoning,
      steps: q.steps.map((text, i) => ({ step: i + 1, text })),
      shortcuts: q.shortcuts,
      difficulty,
      difficultyBasis: 'Difficulty label provided in source PDF' + (q.difficulty.toLowerCase() === 'beginner' ? ' (mapped from "Beginner")' : ''),
      reviewStatus: 'APPROVED',
      sourceDocument: 'MOCK TEST.pdf.pdf',
      sourcePage: q.page,
      sourceKey: `MOCK25-${String(m.index).padStart(2, '0')}-${String(q.num).padStart(2, '0')}`,
      companySlug: slug,
      companyName: m.companyName,
      fingerprint: fingerprint(q.stem, q.options, q.correctLabel),
    });
  }
  outMocks.push({
    index: m.index,
    companySlug: slug,
    companyName: m.companyName,
    emphasis: m.emphasis,
    sectionsLine: m.sectionsLine,
    difficultyMix: m.difficultyMix,
    sourceNote: 'Company-style practice mock from the TitanApt "MOCK TEST.pdf" set (Top 25 Indian IT Companies). Original practice questions in a general campus-placement style; NOT real, leaked or previous company questions; no company endorsement. Answers were computed and cross-checked by the original set author.',
    questions,
  });
}
console.log('unknown topics:', [...unknownTopics]);
console.log('companies out:', outMocks.length, 'questions out:', outMocks.reduce((a, m) => a + m.questions.length, 0));

// duplicate analysis
const fpIndex = new Map();
const dupPairs = [];
for (const item of [
  ...existingQuestions.map((q) => ({ o: 'existing:' + q.sourceKey, fp: q.fingerprint })),
  ...outMocks.flatMap((m) => m.questions.map((q) => ({ o: 'new:' + q.sourceKey, fp: q.fingerprint }))),
]) {
  if (fpIndex.has(item.fp)) dupPairs.push([fpIndex.get(item.fp).o, item.o]);
  else fpIndex.set(item.fp, item);
}
const newDups = dupPairs.filter((p) => p.some((o) => o.startsWith('new:')));
console.log('duplicate pairs:', dupPairs.length, '(new-involving:', newDups.length, ')');
newDups.forEach((p) => console.log('NEW DUP:', p[0], '<->', p[1]));

fs.writeFileSync(OUT, JSON.stringify({ mocks: outMocks }, null, 1), 'utf8');
console.log('WROTE', OUT);
