// Cross-entity search for the Dashboard search bar: topics, lessons, chapter
// groups, IT companies, mock tests, study volumes, practice subjects and
// navigation destinations. Case-insensitive partial matching with deduping.
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { LEARNING_VOLUMES } from '@titanapt/shared';
import type { Subject } from '@prisma/client';

export const searchRouter = Router();
searchRouter.use(requireAuth);

type SearchHit = {
  type: string;
  title: string;
  subtitle?: string;
  route: string;
};

const SUBJECT_KEYWORDS: Array<{ subject: Subject; label: string; aliases: string[] }> = [
  { subject: 'QUANTITATIVE', label: 'Quantitative aptitude practice', aliases: ['quant', 'quantitative', 'maths', 'math', 'arithmetic'] },
  { subject: 'LOGICAL', label: 'Logical reasoning practice', aliases: ['logical', 'reasoning', 'puzzles', 'logic'] },
  { subject: 'VERBAL', label: 'Verbal ability practice', aliases: ['verbal', 'english', 'grammar', 'vocabulary'] },
  { subject: 'DATA_INTERPRETATION', label: 'Data interpretation practice', aliases: ['data', 'interpretation', 'charts', 'tables'] },
  { subject: 'TECHNICAL', label: 'Technical practice', aliases: ['technical', 'programming', 'coding', 'computer'] },
];

const NAVIGATION: Array<{ label: string; subtitle: string; route: string; aliases: string[] }> = [
  { label: 'Dashboard', subtitle: 'Your workspace', route: '/app', aliases: ['dashboard', 'home'] },
  { label: 'Practice', subtitle: 'Answer questions by topic', route: '/app/practice', aliases: ['practice', 'questions', 'drills'] },
  { label: 'Learning Hub', subtitle: 'The 8 study volumes', route: '/app/learning', aliases: ['learning hub', 'hub', 'volumes', 'learning'] },
  { label: 'Topic lessons', subtitle: 'Lessons by topic', route: '/app/learn', aliases: ['topic lessons', 'lessons', 'topics', 'learn'] },
  { label: 'Mock tests', subtitle: 'Timed papers by company', route: '/app/mocks', aliases: ['mock tests', 'mocks', 'tests'] },
  { label: 'Crack Time', subtitle: 'Focused study timer', route: '/app/crack-time', aliases: ['crack time', 'cracktime', 'timer', 'focus'] },
  { label: 'Companies', subtitle: '26 IT employer profiles', route: '/app/companies', aliases: ['companies', 'company', 'employers', 'it companies'] },
  { label: 'Readiness', subtitle: 'Placement-readiness checklist', route: '/app/readiness', aliases: ['readiness', 'checklist', 'placement'] },
  { label: 'Progress', subtitle: 'Accuracy and history', route: '/app/progress', aliases: ['progress', 'analytics', 'stats'] },
  { label: 'Bookmarks', subtitle: 'Saved questions', route: '/app/bookmarks', aliases: ['bookmarks', 'saved'] },
  { label: 'Settings', subtitle: 'Profile, theme and goals', route: '/app/settings', aliases: ['settings', 'profile', 'preferences', 'theme'] },
];

const MAX_PER_GROUP = 8;

type Counted = { hit: SearchHit; score: number };

function normalize(value: string): string {
  return value.toLowerCase();
}

function scoreText(haystacks: Array<string | null | undefined>, words: string[]): number {
  const normalized = haystacks.filter((value): value is string => Boolean(value)).map(normalize);
  let score = 0;
  for (const word of words) {
    if (normalized.some((value) => value.split(/[^a-z0-9]+/).some((token) => token.startsWith(word)))) score += 2;
    else if (normalized.some((value) => value.includes(word))) score += 1;
    else return 0;
  }
  return score;
}

function compact(hits: Counted[]): SearchHit[] {
  return hits
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title))
    .slice(0, MAX_PER_GROUP)
    .map((entry) => entry.hit);
}

searchRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const raw = String(req.query.q ?? '').trim();
    if (raw.length > 80) throw badRequest('QUERY_TOO_LONG', 'Search terms must be 80 characters or fewer.');
    const words = normalize(raw).split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      res.json({ data: { query: raw, groups: [] } });
      return;
    }

    const [topics, lessons, companies, mocks] = await Promise.all([
      prisma.topic.findMany({
        where: { isPublished: true },
        select: { slug: true, name: true, subject: true, group: true, description: true },
        orderBy: [{ subject: 'asc' }, { order: 'asc' }],
      }),
      prisma.lesson.findMany({
        where: { status: 'APPROVED', topic: { isPublished: true } },
        select: { title: true, topic: { select: { slug: true, name: true, subject: true } } },
        orderBy: { order: 'asc' },
      }),
      prisma.company.findMany({
        select: { slug: true, name: true, initials: true, industries: true },
        orderBy: { order: 'asc' },
      }),
      prisma.mockTest.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, title: true, description: true, durationMinutes: true },
        orderBy: { title: 'asc' },
      }),
    ]);

    const topicHits: Counted[] = topics.map((topic) => ({
      hit: {
        type: 'Topic',
        title: topic.name,
        subtitle: topic.description.slice(0, 90),
        route: `/app/learn/${topic.slug}`,
      },
      score: scoreText([topic.name, topic.group, topic.description], words),
    }));

    const seenTopics = new Set(compact(topicHits).map((hit) => hit.route));
    const lessonHits: Counted[] = lessons.map((lesson) => ({
      hit: {
        type: 'Lesson',
        title: lesson.title,
        subtitle: lesson.topic.name,
        route: `/app/learn/${lesson.topic.slug}`,
      },
      score: scoreText([lesson.title, lesson.topic.name], words),
    }));

    const companyHits: Counted[] = companies.map((company) => ({
      hit: {
        type: 'Company',
        title: company.name,
        subtitle: company.industries?.split(',')[0]?.trim() ?? 'IT services',
        route: `/app/companies/${company.slug}`,
      },
      score: scoreText([company.name, company.industries], words),
    }));

    const mockHits: Counted[] = mocks.map((mock) => ({
      hit: {
        type: 'Mock test',
        title: mock.title.replace(' — Company Mock', ' mock'),
        subtitle: `${mock.durationMinutes} min timed paper`,
        route: `/app/mocks/${mock.slug}`,
      },
      score: scoreText([mock.title, mock.description], words),
    }));

    const volumeHits: Counted[] = LEARNING_VOLUMES.map((volume) => ({
      hit: {
        type: 'Learning Hub',
        title: volume.title,
        subtitle: `${volume.pageCount} pages`,
        route: '/app/learning',
      },
      score: scoreText([volume.title, volume.filename], words),
    }));

    const subjectHits: Counted[] = SUBJECT_KEYWORDS.map((entry) => ({
      hit: {
        type: 'Practice',
        title: entry.label,
        subtitle: 'Start a practice session with this filter',
        route: `/app/practice?subject=${entry.subject}`,
      },
      score: scoreText([entry.label, ...entry.aliases], words),
    }));

    const navigationHits: Counted[] = NAVIGATION.map((entry) => ({
      hit: { type: 'Page', title: entry.label, subtitle: entry.subtitle, route: entry.route },
      score: scoreText([entry.label, ...entry.aliases], words),
    }));

    const groups = ([
      ['Topics', compact(topicHits)],
      ['Lessons', compact(lessonHits)],
      ['Practice', compact(subjectHits)],
      ['Companies', compact(companyHits)],
      ['Mock tests', compact(mockHits)],
      ['Volumes', compact(volumeHits)],
      ['Pages', compact(navigationHits)],
    ] as Array<[string, SearchHit[]]>)
      // drop lessons that only repeat a topic already shown
      .map(([label, hits]) => [label, label === 'Lessons' ? hits.filter((hit) => !seenTopics.has(hit.route)) : hits] as [string, SearchHit[]])
      .filter(([, hits]) => hits.length > 0);

    res.json({ data: { query: raw, groups: groups.map(([label, hits]) => ({ label, hits })) } });
  }),
);
