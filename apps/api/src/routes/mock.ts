import { Router } from 'express';
import { z } from 'zod';
import { Difficulty, Prisma, Subject } from '@prisma/client';
import { companySlugForMockSlug } from '@titanapt/shared';
import { prisma } from '../prisma.js';
import { asyncHandler, conflict, notFound, parseBody } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { parseMarking, parseSections } from '../lib/mock.js';
import { questionInclude, toQuestionView } from '../lib/questionView.js';
import { percentage, scoreAnswers } from '../lib/metrics.js';
import { touchStreakDay } from '../lib/streak.js';

export const mockRouter = Router();

mockRouter.use(requireAuth);

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function getAttemptForUser(attemptId: string, userId: string) {
  return prisma.mockTestAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      mockTest: true,
      questions: {
        orderBy: { position: 'asc' },
        include: { question: { include: questionInclude } },
      },
    },
  });
}

type LoadedAttempt = NonNullable<Awaited<ReturnType<typeof getAttemptForUser>>>;

function attemptPayload(attempt: LoadedAttempt, includeResults = false) {
  if (!attempt) throw notFound('Mock attempt not found.');
  const sections = parseSections(attempt.mockTest.sections);
  const marking = parseMarking(attempt.mockTest.marking);
  const now = Date.now();
  const secondsRemaining = Math.max(0, Math.floor((attempt.deadlineAt.getTime() - now) / 1000));
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    secondsRemaining,
    effectiveDurationMinutes: Math.max(1, Math.round((attempt.deadlineAt.getTime() - attempt.startedAt.getTime()) / 60000)),
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    mock: {
      slug: attempt.mockTest.slug,
      title: attempt.mockTest.title,
      description: attempt.mockTest.description,
      durationMinutes: attempt.mockTest.durationMinutes,
      sections,
      marking,
      sourceNote: attempt.mockTest.sourceNote,
    },
    questions: attempt.questions.map((item) => ({
      ...toQuestionView(item.question),
      position: item.position,
      selectedOptionId: item.selectedOptionId,
      ...(includeResults || attempt.status === 'SUBMITTED'
        ? { correctOptionId: item.question.correctOptionId, explanation: item.question.explanation, steps: item.question.steps }
        : {}),
    })),
  };
}

mockRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const mocks = await prisma.mockTest.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'asc' },
      include: {
        attempts: {
          where: { userId: req.user!.id },
          orderBy: { startedAt: 'desc' },
          select: { id: true, status: true, percentage: true, score: true, maxScore: true, startedAt: true, submittedAt: true },
        },
      },
    });
    // Company identity is resolved once here, from the canonical company
    // records behind each company mock — never derived from the mock slug on
    // the client, which broke symbol-logo filenames for two pdf-slug mocks.
    const companies = await prisma.company.findMany();
    const companyBySlug = new Map(companies.map((company) => [company.slug, company]));
    res.json({
      data: mocks.map((mock) => {
        const company = isCompanyMock(mock.slug)
          ? companyBySlug.get(companySlugForMockSlug(mock.slug)) ?? null
          : null;
        return {
          id: mock.id,
          slug: mock.slug,
          title: mock.title,
          description: mock.description,
          durationMinutes: mock.durationMinutes,
          sections: parseSections(mock.sections),
          marking: parseMarking(mock.marking),
          sourceNote: mock.sourceNote,
          company: company
            ? { slug: company.slug, name: company.name, logoUrl: `/company-logos/${company.slug}.png`, initials: company.initials }
            : null,
          attempts: mock.attempts.map((attempt) => ({
            ...attempt,
            startedAt: attempt.startedAt.toISOString(),
            submittedAt: attempt.submittedAt?.toISOString() ?? null,
          })),
        };
      }),
    });
  }),
);

mockRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const mock = await prisma.mockTest.findUnique({ where: { slug: req.params.slug } });
    if (!mock || mock.status !== 'PUBLISHED') throw notFound('Mock test not found.');
    const attempts = await prisma.mockTestAttempt.findMany({
      where: { userId: req.user!.id, mockTestId: mock.id },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, percentage: true, startedAt: true, submittedAt: true },
    });
    res.json({
      data: {
        id: mock.id,
        slug: mock.slug,
        title: mock.title,
        description: mock.description,
        durationMinutes: mock.durationMinutes,
        sections: parseSections(mock.sections),
        marking: parseMarking(mock.marking),
        sourceNote: mock.sourceNote,
        company: isCompanyMock(mock.slug)
          ? await companyForMock(mock.slug).then((company) =>
              company
                ? { slug: company.slug, name: company.name, logoUrl: `/company-logos/${company.slug}.png`, initials: company.initials }
                : null,
            )
          : null,
        attempts,
      },
    });
  }),
);

/** Canonical category names shown on the mock-test selection screen. The
 *  filter granularity is the question's subject — the finest level actually
 *  stored on every approved question record. */
const SUBJECT_CATEGORY_LABEL: Record<Subject, string> = {
  QUANTITATIVE: 'Quantitative Aptitude',
  LOGICAL: 'Logical and Analytical Reasoning',
  VERBAL: 'Verbal Ability and English',
  DATA_INTERPRETATION: 'Data Interpretation and Data Sufficiency',
  TECHNICAL: 'Computer Fundamentals and Programming Logic',
};
const ALL_SUBJECTS = Object.values(Subject) as Subject[];

function isCompanyMock(slug: string): boolean {
  return slug.startsWith('company-mock-');
}

async function companyForMock(slug: string) {
  // Company slugs resolve through the stable alias map (shared package) so a
  // published mock slug always reaches its canonical company record.
  const companySlug = companySlugForMockSlug(slug);
  return prisma.company.findUnique({ where: { slug: companySlug } });
}

/** Config endpoint powering the mock-test setup UI: verifies how many
 *  approved questions each difficulty filter can draw from, per company. */
mockRouter.get(
  '/:slug/config',
  asyncHandler(async (req, res) => {
    const mock = await prisma.mockTest.findUnique({ where: { slug: req.params.slug } });
    if (!mock || mock.status !== 'PUBLISHED') throw notFound('Mock test not found.');
    const base: Prisma.QuestionWhereInput = {
      reviewStatus: 'APPROVED',
      correctOptionId: { not: null },
    };
    if (isCompanyMock(mock.slug)) {
      const company = await companyForMock(mock.slug);
      if (!company) throw notFound('That company mock is not linked to a company profile anymore.');
      base.companyTags = { has: company.name };
    } else {
      base.topic = { isPublished: true };
    }
    // Optional aptitude-category filter: granularity is the question's
    // stored subject, the finest level actually persisted on every record.
    const requestedCategory = typeof req.query.category === 'string' ? req.query.category.toUpperCase() : '';
    if (requestedCategory && !ALL_SUBJECTS.includes(requestedCategory as Subject)) {
      throw notFound('That category is not available for this mock.');
    }
    const poolBase: Prisma.QuestionWhereInput = requestedCategory
      ? {
          ...base,
          topic: {
            ...((base.topic as Prisma.TopicWhereInput | undefined) ?? {}),
            subject: requestedCategory as Subject,
            isPublished: true,
          },
        }
      : base;
    // Question subject lives on the related topic, so count from the
    // UNfiltered pool (the category list must stay switchable even while one
    // category is selected) and derive the filtered difficulty counts here.
    const poolRows = await prisma.question.findMany({
      where: base,
      select: { difficulty: true, topic: { select: { subject: true } } },
    });
    const counts = { any: 0, easy: 0, medium: 0, hard: 0 } as Record<'any' | 'easy' | 'medium' | 'hard', number>;
    const subjectCounts = new Map<Subject, number>();
    const subjectDifficultyCounts = new Map<Subject, Record<'any' | 'easy' | 'medium' | 'hard', number>>();
    for (const row of poolRows) {
      counts[row.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'] += 1;
      counts.any += 1;
      subjectCounts.set(row.topic.subject, (subjectCounts.get(row.topic.subject) ?? 0) + 1);
      const bucket = subjectDifficultyCounts.get(row.topic.subject) ?? { any: 0, easy: 0, medium: 0, hard: 0 };
      bucket[row.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'] += 1;
      bucket.any += 1;
      subjectDifficultyCounts.set(row.topic.subject, bucket);
    }
    // Difficulty counts honour the selected category when one is active
    const filteredCounts = requestedCategory
      ? (subjectDifficultyCounts.get(requestedCategory as Subject) ?? counts)
      : counts;
    // categories: what this mock can actually draw from, never fabricated
    const categories = ALL_SUBJECTS.filter((subject) => (subjectCounts.get(subject) ?? 0) > 0).map((subject) => ({
      subject,
      label: SUBJECT_CATEGORY_LABEL[subject],
      count: subjectCounts.get(subject) ?? 0,
    }));
    const configCompany = isCompanyMock(mock.slug) ? await companyForMock(mock.slug) : null;
    res.json({
      data: {
        slug: mock.slug,
        title: mock.title,
        company: configCompany?.name ?? null,
        logoUrl: configCompany ? `/company-logos/${configCompany.slug}.png` : null,
        defaults: { durationMinutes: mock.durationMinutes, questionCount: parseSections(mock.sections).reduce((sum, s) => sum + s.count, 0) },
        marking: parseMarking(mock.marking),
        pool: filteredCounts,
        anyPool: counts,
        categories,
        ranges: { questionCount: [5, 60], durationMinutes: [5, 120] },
      },
    });
  }),
);

const mockStartConfigSchema = z
  .object({
    difficulty: z.nativeEnum(Difficulty).optional(),
    category: z.nativeEnum(Subject).optional(),
    questionCount: z.coerce.number().int().min(5).max(60).optional(),
    durationMinutes: z.coerce.number().int().min(5).max(120).optional(),
  })
  .partial();

/** Selects questions directly from the approved pool honouring the setup
 *  options the learner chose on the mock-test configuration screen. */
async function selectConfiguredQuestions(
  mock: { slug: string; title: string },
  config: { difficulty?: Difficulty; category?: Subject; questionCount?: number; durationMinutes?: number },
): Promise<{ ids: string[]; sectionName: string }> {
  const base: Prisma.QuestionWhereInput = {
    reviewStatus: 'APPROVED',
    correctOptionId: { not: null },
  };
  let sectionName = mock.title;
  if (isCompanyMock(mock.slug)) {
    const company = await companyForMock(mock.slug);
    if (!company) throw notFound('That company mock is not linked to a company profile anymore.');
    base.companyTags = { has: company.name };
    sectionName = company.name;
  } else {
    base.topic = { isPublished: true };
  }
  if (config.difficulty) base.difficulty = config.difficulty;
  if (config.category) {
    base.topic = {
      ...((base.topic as Prisma.TopicWhereInput | undefined) ?? {}),
      subject: config.category,
      isPublished: true,
    };
  }

  const available = await prisma.question.findMany({ where: base, select: { id: true } });
  const count = config.questionCount ?? 30;
  if (available.length < count) {
    throw conflict(
      'MOCK_POOL_TOO_SMALL',
      `Only ${available.length} verified question${available.length === 1 ? '' : 's'} match that filter. Lower the difficulty or the question count.`,
    );
  }
  return { ids: shuffle(available).slice(0, count).map((row) => row.id), sectionName };
}

mockRouter.post(
  '/:slug/start',
  asyncHandler(async (req, res) => {
    const mock = await prisma.mockTest.findUnique({ where: { slug: req.params.slug } });
    if (!mock || mock.status !== 'PUBLISHED') throw notFound('Mock test not found.');
    const sections = parseSections(mock.sections);

    // Optional learner configuration (difficulty / question count / duration).
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    const config = Object.keys(rawBody).filter((key) => rawBody[key] !== undefined && rawBody[key] !== '').length > 0
      ? parseBody(mockStartConfigSchema, req)
      : {} as { difficulty?: Difficulty; category?: Subject; questionCount?: number; durationMinutes?: number };
    const configured =
      config.difficulty !== undefined ||
      config.category !== undefined ||
      config.questionCount !== undefined ||
      config.durationMinutes !== undefined;
    const durationMinutes = configured && config.durationMinutes ? config.durationMinutes : mock.durationMinutes;

    const active = await prisma.mockTestAttempt.findFirst({
      where: { userId: req.user!.id, mockTestId: mock.id, status: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
      include: {
        mockTest: true,
        questions: { orderBy: { position: 'asc' }, include: { question: { include: questionInclude } } },
      },
    });
    if (active) {
      if (active.deadlineAt.getTime() <= Date.now()) {
        await prisma.mockTestAttempt.update({ where: { id: active.id }, data: { status: 'EXPIRED' } });
      } else {
        return res.json({ data: { ...attemptPayload(active), resumed: true } });
      }
    }

    let selectedIds: string[];
    if (configured) {
      selectedIds = (await selectConfiguredQuestions(mock, config)).ids;
    } else {
      selectedIds = [];
      for (const section of sections) {
        if (section.questions?.length) {
          const found = await prisma.question.findMany({
            where: { sourceKey: { in: section.questions }, reviewStatus: 'APPROVED', correctOptionId: { not: null } },
            select: { id: true, sourceKey: true },
          });
          const idByKey = new Map(found.map((row) => [row.sourceKey, row.id]));
          const ordered = section.questions
            .map((key) => idByKey.get(key))
            .filter((id): id is string => Boolean(id))
            .filter((id) => !selectedIds.includes(id));
          if (ordered.length < section.count) {
            throw conflict('MOCK_POOL_TOO_SMALL', `"${section.name}" needs ${section.count} verified questions but only ${ordered.length} are available. Re-run the seed to restore the question set.`);
          }
          selectedIds.push(...ordered);
          continue;
        }
        const available = await prisma.question.findMany({
          where: {
            reviewStatus: 'APPROVED',
            correctOptionId: { not: null },
            topic: { subject: section.subject, isPublished: true },
            ...(section.difficulty ? { difficulty: section.difficulty } : {}),
            id: { notIn: selectedIds },
          },
          select: { id: true },
        });
        if (available.length < section.count) {
          throw conflict('MOCK_POOL_TOO_SMALL', `"${section.name}" needs ${section.count} verified questions but only ${available.length} are available. Add reviewed questions or edit the mock.`);
        }
        selectedIds.push(...shuffle(available).slice(0, section.count).map((row) => row.id));
      }
    }

    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const attempt = await prisma.mockTestAttempt.create({
      data: {
        userId: req.user!.id,
        mockTestId: mock.id,
        startedAt,
        deadlineAt,
        questions: {
          create: selectedIds.map((questionId, index) => ({ questionId, position: index + 1 })),
        },
      },
    });
    const loaded = await prisma.mockTestAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: {
        mockTest: true,
        questions: { orderBy: { position: 'asc' }, include: { question: { include: questionInclude } } },
      },
    });
    res.status(201).json({ data: { ...attemptPayload(loaded), effectiveDurationMinutes: durationMinutes, resumed: false } });
  }),
);

mockRouter.get(
  '/attempts/:attemptId',
  asyncHandler(async (req, res) => {
    const attempt = await getAttemptForUser(req.params.attemptId, req.user!.id);
    if (!attempt) throw notFound('Mock attempt not found.');
    if (attempt.status === 'IN_PROGRESS' && attempt.deadlineAt.getTime() <= Date.now()) {
      await prisma.mockTestAttempt.update({ where: { id: attempt.id }, data: { status: 'EXPIRED' } });
      attempt.status = 'EXPIRED';
    }
    res.json({ data: attemptPayload(attempt) });
  }),
);

const answerSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1).nullable(),
});

mockRouter.patch(
  '/attempts/:attemptId/answer',
  asyncHandler(async (req, res) => {
    const input = parseBody(answerSchema, req);
    const attempt = await prisma.mockTestAttempt.findFirst({
      where: { id: req.params.attemptId, userId: req.user!.id },
      include: { questions: { where: { questionId: input.questionId }, include: { question: { include: { options: true } } } } },
    });
    if (!attempt) throw notFound('Mock attempt not found.');
    if (attempt.status !== 'IN_PROGRESS') throw conflict('ATTEMPT_CLOSED', 'This attempt is no longer accepting answers.');
    if (attempt.deadlineAt.getTime() <= Date.now()) {
      await prisma.mockTestAttempt.update({ where: { id: attempt.id }, data: { status: 'EXPIRED' } });
      throw conflict('TIME_EXPIRED', 'Time is up. Submit the attempt to see your score.');
    }
    const item = attempt.questions[0];
    if (!item) throw notFound('That question is not part of this attempt.');
    if (input.optionId && !item.question.options.some((option) => option.id === input.optionId)) {
      throw conflict('INVALID_OPTION', 'That option does not belong to this question.');
    }
    await prisma.mockAttemptQuestion.update({
      where: { id: item.id },
      data: {
        selectedOptionId: input.optionId,
        answeredAt: input.optionId ? new Date() : null,
      },
    });
    res.json({
      data: {
        savedAt: new Date().toISOString(),
        secondsRemaining: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)),
      },
    });
  }),
);

mockRouter.post(
  '/attempts/:attemptId/submit',
  asyncHandler(async (req, res) => {
    const attempt = await getAttemptForUser(req.params.attemptId, req.user!.id);
    if (!attempt) throw notFound('Mock attempt not found.');
    if (attempt.status === 'SUBMITTED') {
      return res.json({ data: { ...attemptPayload(attempt), idempotent: true } });
    }
    const marking = parseMarking(attempt.mockTest.marking);
    const scored = scoreAnswers(
      attempt.questions.map((item) => ({
        selectedOptionId: item.selectedOptionId,
        correctOptionId: item.question.correctOptionId,
      })),
      marking,
    );
    const submittedAt = new Date();
    await prisma.mockTestAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUBMITTED',
        score: scored.score,
        maxScore: scored.maxScore,
        percentage: scored.percentage,
        submittedAt,
      },
    });
    const updated = await getAttemptForUser(attempt.id, req.user!.id);
    if (!updated) throw notFound('Mock attempt not found after submission.');
    void touchStreakDay(req.user!.id, req.user!.profile?.timezone, 'mock');
    const payload = attemptPayload(updated, true);
    res.status(201).json({
      data: {
        ...payload,
        correct: scored.correct,
        incorrect: scored.incorrect,
        unanswered: scored.unanswered,
        percentage: percentage(scored.score, scored.maxScore),
      },
    });
  }),
);

