import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Prisma, PrismaClient, Subject, Difficulty, LessonLevel, ReviewStatus } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();
const dataPath = (name: string) => new URL(`./data/${name}`, import.meta.url);

type TopicSeed = {
  name: string;
  slug: string;
  subject: string;
  group: string;
  order: number;
  description: string;
  sourceNote: string;
};

type LessonSeed = {
  topicSlug: string;
  slug: string;
  title: string;
  level: string;
  order: number;
  objective: string;
  explanation: string;
  analogy: string;
  workedExamples: unknown;
  rule: unknown;
  mistakes: unknown;
  memoryTip: string;
  practice: unknown;
  sourceRef: string;
  reviewer: string;
};

type CompanySeed = {
  number: number;
  name: string;
  slug: string;
  initials: string;
  overview: string;
  website: string;
  headquarters: string;
  founded: string;
  parent: string;
  mainBusiness: string;
  industries: string;
  technology: string | null;
  platforms: string | null;
  careersUrl: string;
  logoSource: string | null;
  sourceNote: string;
  verifiedAt: string;
  topicSlugs: string[];
};

type QuestionSeed = {
  topic?: string;
  topicSlug?: string;
  subject: string;
  stem: string;
  statement: string;
  options: Array<{ label: string; text: string }>;
  correctLabel: string;
  explanation: string;
  reasoning: string;
  steps: unknown;
  shortcuts: string;
  difficulty: string;
  difficultyBasis: string;
  reviewStatus: string;
  sourceDocument: string;
  sourcePage: number;
  sourceKey: string;
  fingerprint: string;
  sourceCheck: string;
  companyTags?: string[];
  companySlug?: string;
};

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(dataPath(name), 'utf8')) as T;
}

type CompanyMockQuestionSeed = {
  topicSlug: string;
  subject: string;
  sectionName: string;
  stem: string;
  statement: string;
  options: Array<{ label: string; text: string }>;
  correctLabel: string;
  answerText?: string;
  explanation: string;
  reasoning: string;
  steps: unknown;
  shortcuts: string;
  difficulty: string;
  difficultyBasis: string;
  sourceDocument: string;
  sourcePage: number;
  sourceKey: string;
  companySlug: string;
  companyName: string;
  fingerprint: string;
};

type CompanyMockSeed = {
  index: number;
  companySlug: string;
  companyName: string;
  emphasis: string;
  sectionsLine: string;
  difficultyMix: string;
  sourceNote: string;
  questions: CompanyMockQuestionSeed[];
};

const importSources = [
  ['TitanApt_10000_Bigger_ELI10_Complete.pdf', 'Aptitude/Learning Hub.pdf/TitanApt_10000_Bigger_ELI10_Complete.pdf', '7B89360241EF5633ED41D584450C1EA4124186222FF5D42070DFC828DB72A0F4', 4939],
  ['IT_Companies_Guide_with_Zoho.pdf', 'Aptitude/Learning Hub.pdf/IT_Companies_Guide_with_Zoho.pdf', '3ACE6BB842A44A6D33D9D1FC59FAC2D6E63E107A9402CCFEFFE6E858C9704997', 57],
  ['Top25_India_IT_Companies_Mock_Test_30Q_each.pdf', 'Aptitude/Learning Hub.pdf/Top25_India_IT_Companies_Mock_Test_30Q_each.pdf', '571679DAA90F8F44740E82458F808F61574E7C8245E03FDE734747E3EE65A612', 428],
  ['Aptitude_Mastery_Vol1_Quant_Foundations.pdf', 'Aptitude/Learning Hub.pdf/Aptitude_Mastery_Vol1_Quant_Foundations.pdf', '4195DBEE5CCDA6ED6B35D3CA7B89A5A087092ECB8894A4732B7AFFB04575E517', 97],
  ['Volume_2_Quantitative_Aptitude_Advanced.pdf', 'Aptitude/Learning Hub.pdf/Volume_2_Quantitative_Aptitude_Advanced.pdf', '7A695182A6DE4636329E1F0283A7FDDDEDF8D9F0950C616A8608831F3EB16C57', 122],
  ['Volume3_Logical_Reasoning.pdf', 'Aptitude/Learning Hub.pdf/Volume3_Logical_Reasoning.pdf', 'E862F0E7122E5A8F5D82E70D32983282DFB69511448F823425B4BD4F11F65222', 88],
  ['Volume_4_Verbal_Ability_English_Grammar_Vocabulary.pdf', 'Aptitude/Learning Hub.pdf/Volume_4_Verbal_Ability_English_Grammar_Vocabulary.pdf', 'FADED6F2FA6F6498699C77403BE5E7C74B353E96DE3370A566AEB920F7550DC1', 152],
  ['Volume5_Abstract_and_General_Aptitude.pdf', 'Aptitude/Learning Hub.pdf/Volume5_Abstract_and_General_Aptitude.pdf', '4287578073F68B95E50B0D964E60D72E8CDD123D2C89B86BD83EF1FEAF0B9063', 104],
  ['Aptitude_Mastery_Volume6_Programming_Technical.pdf', 'Aptitude/Learning Hub.pdf/Aptitude_Mastery_Volume6_Programming_Technical.pdf', 'B7379589EB88B94B5E54A0B27998F68849764D231D1C06BA6DC9E1C3582B842D', 142],
  ['Aptitude_Mastery_Volume7_Placement_Practice_Mock_Tests.pdf', 'Aptitude/Learning Hub.pdf/Aptitude_Mastery_Volume7_Placement_Practice_Mock_Tests.pdf', '82464BFCEB34CD02073106E6195CB11FD8A1306BA4DABFF11ECBC045C655B68F', 48],
  ['Complete_Aptitude_Mastery_Volume_8.pdf', 'Aptitude/Learning Hub.pdf/Complete_Aptitude_Mastery_Volume_8.pdf', 'ADEB885B6AD6845264DCFB5589DE996682252FFC62BE177677688435F4CB1D02', 64],
] as const;

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL or ADMIN_PASSWORD is missing; skipping admin seed.');
    return;
  }
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const emailNormalized = email.trim().normalize('NFKC').toLowerCase();
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'TitanApt Admin';
  await prisma.user.upsert({
    where: { emailNormalized },
    create: {
      emailOriginal: email.trim(),
      emailNormalized,
      passwordHash,
      role: 'ADMIN',
      profile: { create: { displayName, timezone: 'Asia/Kolkata', dailyGoal: 10 } },
    },
    update: {
      passwordHash,
      role: 'ADMIN',
      profile: { upsert: { create: { displayName, timezone: 'Asia/Kolkata', dailyGoal: 10 }, update: { displayName } } },
    },
  });
  console.log(`Admin ready: ${emailNormalized}`);
}

async function seedImportSources() {
  for (const [filename, relativePath, checksum, pageCount] of importSources) {
    await prisma.importSource.upsert({
      where: { checksum },
      create: {
        filename,
        relativePath,
        checksum,
        pageCount,
        extractionStatus: 'TEXT_LAYER',
        licensingNote: 'Supplied by the project owner for this private build. Source PDFs remain the authoritative copies; no public redistribution rights are implied.',
        importStatus: filename === 'TitanApt_10000_Bigger_ELI10_Complete.pdf' ? 'sample_imported' : 'registered',
      },
      update: { filename, relativePath, pageCount },
    });
  }
  // "MOCK TEST.pdf" (Top 25 Indian IT Companies company-style mocks)
  {
    const pdfPath = new URL('../Img-pdf/MOCK TEST.pdf.pdf', import.meta.url);
    const bytes = await readFile(pdfPath);
    const checksum = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    await prisma.importSource.upsert({
      where: { checksum },
      create: {
        filename: 'MOCK TEST.pdf.pdf',
        relativePath: 'Img-pdf/MOCK TEST.pdf.pdf',
        checksum,
        pageCount: 428,
        extractionStatus: 'TEXT_LAYER',
        licensingNote: 'TitanApt-original company-style mock test set (Top 25 Indian IT Companies), 25 tables x 30 questions with keys and ELI10 explanations. Supplied by the project owner; original practice content, not company-affiliated.',
        importStatus: 'fully_imported_company_mocks',
      },
      update: { filename: 'MOCK TEST.pdf.pdf', relativePath: 'Img-pdf/MOCK TEST.pdf.pdf', pageCount: 428 },
    });
  }
  const source = await prisma.importSource.findUnique({ where: { checksum: importSources[0][2] } });
  if (!source) return;
  const existing = await prisma.importJob.findFirst({ where: { sourceId: source.id, candidateCount: 200 } });
  if (!existing) {
    await prisma.importJob.create({
      data: {
        sourceId: source.id,
        status: 'COMPLETED',
        processedPages: 25,
        candidateCount: 200,
        approvedCount: 175,
        skippedCount: 25,
        warnings: [
          'Sample import only: 200 candidates from the full 4,939-page document.',
          '25 candidates remain PENDING and are excluded from learner practice.',
          'Full-document import is not claimed; use the importer and administrative review workflow for more questions.',
        ],
        finishedAt: new Date(),
      },
    });
  }
  console.log('Import sources registered.');
}

const QUESTION_TAG_SUBJECT: Record<string, Subject> = {
  'Quantitative Aptitude': 'QUANTITATIVE',
  'Logical and Analytical Reasoning': 'LOGICAL',
  'Verbal Ability and English': 'VERBAL',
  'Data Interpretation and Data Sufficiency': 'DATA_INTERPRETATION',
  'Advanced Mathematical Reasoning': 'QUANTITATIVE',
  'Probability, Statistics and Combinatorics': 'QUANTITATIVE',
  'Computer Fundamentals and Digital Logic': 'TECHNICAL',
  'Programming Logic and Computational Thinking': 'TECHNICAL',
  'Programming Logic - C Program Output': 'TECHNICAL',
  'Critical Thinking and Problem Solving': 'LOGICAL',
};

async function seedCompanyMocks(companyMocks: CompanyMockSeed[]) {
  if (companyMocks.length !== 25) {
    throw new Error(`Expected 25 company mock sets, found ${companyMocks.length}.`);
  }
  const marking = { correct: 1, incorrect: -0.25, unanswered: 0 };
  let totalQuestions = 0;
  for (const setData of companyMocks) {
    if (setData.questions.length !== 30) {
      throw new Error(`Company mock ${setData.companyName} has ${setData.questions.length} questions, expected 30.`);
    }
    // group question source keys by PDF section, preserving PDF order
    const sections = [] as Array<{ name: string; subject: string; count: number; questions: string[] }>;
    for (const q of setData.questions) {
      const sectionName = (q as { sectionName?: string }).sectionName ?? 'Quantitative Aptitude';
      let section = sections.find((s) => s.name === sectionName);
      if (!section) {
        const subject = QUESTION_TAG_SUBJECT[sectionName] ?? 'QUANTITATIVE';
        section = { name: sectionName, subject, count: 0, questions: [] };
        sections.push(section);
      }
      section.questions.push(q.sourceKey);
    }
    for (const s of sections) s.count = s.questions.length;
    totalQuestions += setData.questions.length;

    const description = `Company-style practice mock for ${setData.companyName}. Emphasis: ${setData.emphasis || 'arithmetic, reasoning, verbal ability and basic coding logic.'} ${setData.difficultyMix ? `Difficulty mix: ${setData.difficultyMix}.` : ''}`.trim();
    await prisma.mockTest.upsert({
      where: { slug: `company-mock-${setData.companySlug}` },
      create: {
        slug: `company-mock-${setData.companySlug}`,
        title: `${setData.companyName} — Company Mock`,
        description,
        durationMinutes: 30,
        sections: sections as unknown as Prisma.InputJsonValue,
        marking,
        status: 'PUBLISHED',
        sourceNote: setData.sourceNote,
      },
      update: {
        title: `${setData.companyName} — Company Mock`,
        description,
        durationMinutes: 30,
        sections: sections as unknown as Prisma.InputJsonValue,
        marking,
        status: 'PUBLISHED',
        sourceNote: setData.sourceNote,
      },
    });
  }
  console.log(`Company mock tests: ${companyMocks.length} published with ${totalQuestions} questions.`);
}

async function main() {
  const topics = await readJson<TopicSeed[]>('topics.json');
  const lessons = await readJson<LessonSeed[]>('lessons.json');
  const companies = await readJson<CompanySeed[]>('companies.json');
  const questions = await readJson<QuestionSeed[]>('questions.json');
  const top25Questions = await readJson<QuestionSeed[]>('top25-questions.json');
  const companyMockData = await readJson<{ mocks: CompanyMockSeed[] }>('company-mocks.json');
  const companyMocks = companyMockData.mocks;
  if (companyMocks.length !== 25) throw new Error(`Expected 25 company mock sets, found ${companyMocks.length}.`);
  const companyMockQuestions: QuestionSeed[] = companyMocks.flatMap((mockSet) =>
    mockSet.questions.map((q) => ({
      ...q,
      reviewStatus: 'APPROVED',
      companyTags: [q.companyName],
      sourceCheck: 'Answer provided in the source PDF answer key (original facts verified by the set author).',
    })),
  );
  const allQuestions = [...questions, ...top25Questions, ...companyMockQuestions];

  if (topics.length !== 28) throw new Error(`Expected 28 topics, found ${topics.length}.`);
  if (lessons.length !== 136) throw new Error(`Expected 136 lessons, found ${lessons.length}.`);
  if (companies.length !== 26) throw new Error(`Expected 26 companies, found ${companies.length}.`);
  if (questions.length !== 200) throw new Error(`Expected 200 sample questions, found ${questions.length}.`);
  if (top25Questions.length !== 750) throw new Error(`Expected 750 Top25 questions, found ${top25Questions.length}.`);
  if (companyMockQuestions.length !== 750) throw new Error(`Expected 750 company-mock questions, found ${companyMockQuestions.length}.`);
  if (allQuestions.length !== 1700) throw new Error(`Expected 1700 total questions, found ${allQuestions.length}.`);

  await seedAdmin();
  await seedImportSources();

  const topicBySlug = new Map<string, { id: string; slug: string; name: string; subject: Subject }>();
  for (const topic of topics) {
    const row = await prisma.topic.upsert({
      where: { slug: topic.slug },
      create: {
        slug: topic.slug,
        name: topic.name,
        subject: topic.subject as Subject,
        group: topic.group,
        description: topic.description,
        order: topic.order,
        isPublished: true,
        sourceNote: topic.sourceNote,
      },
      update: {
        name: topic.name,
        subject: topic.subject as Subject,
        group: topic.group,
        description: topic.description,
        order: topic.order,
        isPublished: true,
        sourceNote: topic.sourceNote,
      },
    });
    topicBySlug.set(row.slug, { id: row.id, slug: row.slug, name: row.name, subject: row.subject });
  }
  console.log(`Topics: ${topicBySlug.size}`);

  const companiesByTopic = new Map<string, string[]>();
  for (const company of companies) {
    for (const slug of company.topicSlugs) {
      const names = companiesByTopic.get(slug) ?? [];
      names.push(company.name);
      companiesByTopic.set(slug, names);
    }
    await prisma.company.upsert({
      where: { slug: company.slug },
      create: {
        slug: company.slug,
        name: company.name,
        initials: company.initials,
        overview: company.overview,
        website: company.website,
        headquarters: company.headquarters,
        founded: company.founded,
        parent: company.parent,
        mainBusiness: company.mainBusiness,
        industries: company.industries,
        technology: company.technology,
        platforms: company.platforms,
        careersUrl: company.careersUrl,
        logoSource: company.logoSource,
        logoStatus: 'Guide-supplied company mark for identification; not an official brand asset. Verify usage before publication.',
        sourceNote: company.sourceNote,
        verifiedAt: new Date(company.verifiedAt),
        topicSlugs: company.topicSlugs,
        order: company.number,
      },
      update: {
        name: company.name,
        initials: company.initials,
        overview: company.overview,
        website: company.website,
        headquarters: company.headquarters,
        founded: company.founded,
        parent: company.parent,
        mainBusiness: company.mainBusiness,
        industries: company.industries,
        technology: company.technology,
        platforms: company.platforms,
        careersUrl: company.careersUrl,
        logoSource: company.logoSource,
        logoStatus: 'Guide-supplied company mark for identification; not an official brand asset. Verify usage before publication.',
        sourceNote: company.sourceNote,
        verifiedAt: new Date(company.verifiedAt),
        topicSlugs: company.topicSlugs,
        order: company.number,
      },
    });
  }
  console.log(`Companies: ${companies.length}`);

  let approved = 0;
  let pending = 0;
  for (const question of allQuestions) {
    const topicSlug = question.topicSlug ?? topics.find((candidate) => candidate.name === question.topic)?.slug ?? '';
    const topic = topicBySlug.get(topicSlug);
    if (!topic) throw new Error(`Unknown topic in question ${question.sourceKey}: ${question.topicSlug ?? question.topic}`);
    const reviewStatus = question.reviewStatus.toLowerCase() === 'approved' ? ReviewStatus.APPROVED : ReviewStatus.PENDING;
    if (reviewStatus === ReviewStatus.APPROVED) approved += 1;
    else pending += 1;
    const correctLabel = question.correctLabel.trim().toUpperCase();
    if (!question.options.some((option) => option.label.trim().toUpperCase() === correctLabel)) {
      throw new Error(`Correct option ${correctLabel} missing for ${question.sourceKey}.`);
    }
    const baseData = {
      topicId: topic.id,
      stem: question.stem.trim(),
      statement: question.statement?.trim() || null,
      explanation: question.explanation.trim(),
      reasoning: question.reasoning?.trim() || null,
      steps: question.steps as Prisma.InputJsonValue,
      shortcuts: question.shortcuts?.trim() || null,
      difficulty: question.difficulty.toUpperCase() as Difficulty,
      difficultyBasis: question.difficultyBasis,
      reviewStatus,
      fingerprint: question.fingerprint || createHash('sha256').update(question.stem).digest('hex'),
      sourceDocument: question.sourceDocument,
      sourcePage: question.sourcePage,
      sourceKey: question.sourceKey,
      sourceCheck: question.sourceCheck || null,
      companyTags: question.companyTags?.length
        ? question.companyTags
        : ((question as { companyName?: string }).companyName
          ? [(question as { companyName?: string }).companyName!]
          : (companiesByTopic.get(topic.slug) ?? []).slice(0, 8)),
    };

    const row = await prisma.question.upsert({
      where: { sourceKey: question.sourceKey },
      create: {
        ...baseData,
        options: {
          create: question.options.map((option) => ({ label: option.label.trim().toUpperCase(), text: option.text.trim() })),
        },
      },
      update: baseData,
    });

    for (const option of question.options) {
      const label = option.label.trim().toUpperCase();
      const existingOption = await prisma.questionOption.findUnique({
        where: { questionId_label: { questionId: row.id, label } },
      });
      if (!existingOption) {
        await prisma.questionOption.create({
          data: { questionId: row.id, label, text: option.text.trim() },
        });
      } else if (existingOption.text !== option.text.trim()) {
        await prisma.questionOption.update({ where: { id: existingOption.id }, data: { text: option.text.trim() } });
      }
    }
    const correctOption = await prisma.questionOption.findUnique({
      where: { questionId_label: { questionId: row.id, label: correctLabel } },
    });
    if (correctOption && row.correctOptionId !== correctOption.id) {
      await prisma.question.update({ where: { id: row.id }, data: { correctOptionId: correctOption.id } });
    }
  }
  console.log(`Questions: ${approved} approved, ${pending} pending.`);

  // Checkpoint questions: slice the topic's approved pool in lesson order so
  // multiple lessons of the same topic get distinct (non-overlapping)
  // checkpoint windows where the pool is large enough.
  const lessonCounterByTopic = new Map<string, number>();
  for (const lessonData of lessons) {
    const topic = topicBySlug.get(lessonData.topicSlug);
    if (!topic) throw new Error(`Unknown lesson topic: ${lessonData.topicSlug}`);
    const poolDepth = 3;
    const lesson = await prisma.lesson.upsert({
      where: { slug: lessonData.slug },
      create: {
        topicId: topic.id,
        slug: lessonData.slug,
        title: lessonData.title,
        level: lessonData.level as LessonLevel,
        order: lessonData.order,
        status: 'APPROVED',
        objective: lessonData.objective,
        explanation: lessonData.explanation,
        analogy: lessonData.analogy,
        workedExamples: lessonData.workedExamples as Prisma.InputJsonValue,
        rule: lessonData.rule as Prisma.InputJsonValue,
        mistakes: lessonData.mistakes as Prisma.InputJsonValue,
        memoryTip: lessonData.memoryTip,
        practice: lessonData.practice as Prisma.InputJsonValue,
        sourceRef: lessonData.sourceRef,
        reviewer: lessonData.reviewer,
      },
      update: {
        topicId: topic.id,
        title: lessonData.title,
        level: lessonData.level as LessonLevel,
        order: lessonData.order,
        status: 'APPROVED',
        objective: lessonData.objective,
        explanation: lessonData.explanation,
        analogy: lessonData.analogy,
        workedExamples: lessonData.workedExamples as Prisma.InputJsonValue,
        rule: lessonData.rule as Prisma.InputJsonValue,
        mistakes: lessonData.mistakes as Prisma.InputJsonValue,
        memoryTip: lessonData.memoryTip,
        practice: lessonData.practice as Prisma.InputJsonValue,
        sourceRef: lessonData.sourceRef,
        reviewer: lessonData.reviewer,
      },
    });

    const lessonIndexInTopic = lessonCounterByTopic.get(lessonData.topicSlug) ?? 0;
    lessonCounterByTopic.set(lessonData.topicSlug, lessonIndexInTopic + 1);

    const baseCheckpoint = await prisma.question.findMany({
      where: { topicId: topic.id, reviewStatus: 'APPROVED', correctOptionId: { not: null } },
      orderBy: { sourceKey: 'asc' },
      skip: lessonIndexInTopic * poolDepth,
      take: poolDepth,
      select: { id: true },
    });
    // fall back to the topic pool head when the offset window is too small
    const checkpointQuestions =
      baseCheckpoint.length >= 2
        ? baseCheckpoint
        : await prisma.question.findMany({
            where: { topicId: topic.id, reviewStatus: 'APPROVED', correctOptionId: { not: null } },
            orderBy: { sourceKey: 'asc' },
            take: poolDepth,
            select: { id: true },
          });
    await prisma.lessonCheckpoint.deleteMany({ where: { lessonId: lesson.id } });
    if (checkpointQuestions.length < 2) {
      throw new Error(`Lesson ${lesson.slug} needs at least 2 approved checkpoint questions; found ${checkpointQuestions.length}.`);
    }
    await prisma.lessonCheckpoint.createMany({
      data: checkpointQuestions.map((question, index) => ({ lessonId: lesson.id, questionId: question.id, position: index + 1 })),
    });
  }
  console.log(`Lessons: ${lessons.length} with checkpoints.`);

  const marking = { correct: 1, incorrect: -0.25, unanswered: 0 };
  const mocks = [
    {
      slug: 'aptitude-foundation-mock',
      title: 'Aptitude Foundation Mock',
      description: 'A short mixed-subject diagnostic designed to establish a baseline and reveal weak topics.',
      durationMinutes: 30,
      sections: [
        { name: 'Quantitative Aptitude', subject: 'QUANTITATIVE', count: 10 },
        { name: 'Logical Reasoning', subject: 'LOGICAL', count: 6 },
        { name: 'Verbal Ability', subject: 'VERBAL', count: 2 },
        { name: 'Data Interpretation', subject: 'DATA_INTERPRETATION', count: 2 },
      ],
      sourceNote: 'Original TitanApt mock assembled from approved sample questions. Not a real company paper.',
    },
    {
      slug: 'placement-readiness-mock',
      title: 'Placement Readiness Mock',
      description: 'A longer timed set covering quantitative, logical and verbal sections with placement-style marking.',
      durationMinutes: 45,
      sections: [
        { name: 'Quantitative Aptitude', subject: 'QUANTITATIVE', count: 14 },
        { name: 'Logical Reasoning', subject: 'LOGICAL', count: 8 },
        { name: 'Verbal Ability', subject: 'VERBAL', count: 3 },
        { name: 'Data Interpretation', subject: 'DATA_INTERPRETATION', count: 3 },
      ],
      sourceNote: 'Original TitanApt mock assembled from approved sample questions. Not a real company paper.',
    },
  ] as const;

  for (const mock of mocks) {
    await prisma.mockTest.upsert({
      where: { slug: mock.slug },
      create: {
        slug: mock.slug,
        title: mock.title,
        description: mock.description,
        durationMinutes: mock.durationMinutes,
        sections: mock.sections as unknown as Prisma.InputJsonValue,
        marking,
        status: 'PUBLISHED',
        sourceNote: mock.sourceNote,
      },
      update: {
        title: mock.title,
        description: mock.description,
        durationMinutes: mock.durationMinutes,
        sections: mock.sections as unknown as Prisma.InputJsonValue,
        marking,
        status: 'PUBLISHED',
        sourceNote: mock.sourceNote,
      },
    });
  }
  console.log(`Mock tests: ${mocks.length} published.`);
  await seedCompanyMocks(companyMocks);

  const counts = await prisma.$transaction([
    prisma.topic.count(),
    prisma.lesson.count(),
    prisma.company.count(),
    prisma.question.count(),
    prisma.mockTest.count(),
    prisma.user.count(),
  ]);
  console.log(`Seed complete: topics=${counts[0]} lessons=${counts[1]} companies=${counts[2]} questions=${counts[3]} mocks=${counts[4]} users=${counts[5]}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
