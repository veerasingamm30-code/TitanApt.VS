// One-off doc addendum applier for the 2026-11-08 5-level lesson expansion.
const fs = require('fs');

function appendIfAbsent(file, marker, text) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(marker)) {
    console.log(file + ': already has ' + marker + ' (skipped)');
    return;
  }
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(file, s.replace(/\s*$/, '') + nl + nl + text + nl, 'utf8');
  console.log(file + ': appended');
}

appendIfAbsent(
  'PROJECT_AUDIT.md',
  '2026-11-08 lesson expansion',
  [
    '## 7. Status after the 2026-11-08 lesson expansion)',
    '',
    '- Content totals upgraded to **28 topics / 136 lessons / 404 checkpoints** (was 31 lessons / 339 checkpoints).',
    '- 26 topics serve complete 5-level paths (BEGINNER, BASIC, INTERMEDIATE, ADVANCED, EXPERT, orders 1..5);',
    '  calendars-and-clocks went from zero lessons to a full path. boolean-algebra and programming-logic keep',
    '  their legacy 3-lesson paths verbatim (documented PARTIAL).',
    '- LessonLevel enum now has 5 values (migration 20261108090000); enum/level/row-count and per-topic lesson',
    '  continuity verified by scripts/qa/enum-final-check.cjs and scripts/qa/lesson-path-report.cjs.',
    '- Data preservation unchanged: no resets, no data loss; users=58 before and after seeding.',
  ].join('\n'),
);

appendIfAbsent(
  'BUG_FIX_REPORT.md',
  '#17 enum migration',
  [
    '## 17. 2026-11-08: LessonLevel enum too narrow for the 5-level expansion',
    '',
    '- Issue: seed needed BEGINNER/BASIC/INTERMEDIATE/ADVANCED/EXPERT; existing enum had only 3 values (FIXED).',
    '- Root cause: initially authoritative authoring enums were authored as only 3 LessonLevel values.',
    '- Fix: migration 20261108090000_add_lesson_levels_basic_expert recreated the enum with all 5 values',
    '  (PG cannot DROP an enum value; recreate-enum with single-quoted labels is the working syntax),',
    '  applied via `prisma migrate deploy` because `migrate dev` hits checksum drift in this repo.',
    '- A follow-on test pin: `http.test.ts` readiness assertion updated approvedLessons 31 -> 136.',
    '- Residual honesty note: checkpoint windows repeat (head fallback) for the 5 topics whose question pool',
    '  is smaller than 5 items; every lesson still gets a checkpoint.',
  ].join('\n'),
);

appendIfAbsent(
  'IMPLEMENTATION_PLAN.md',
  '2026-11-08',
  [
    '## 2026-11-08 addendum: lesson-path expansion delivered',
    '',
    'Ordered workitems all PASS as of 2026-11-07 (see TEST_RESULTS.md). New scope executed 2026-11-08:',
    '- Expand all 25 single-lesson topics + calendars-and-clocks to 5-level paths; 105 lessons authored,',
    '  merged, seeded (136 total). PASS per Cycle G in TEST_RESULTS.md.',
    '- Migration `20261108090000_add_lesson_levels_basic_expert` applied; shared LESSON_LEVELS constant and',
    '  web level chips extended to 5 values. PASS.',
    'Remaining PARTIAL: boolean-algebra / programming-logic 3-lesson paths (legacy data kept).',
  ].join('\n'),
);
