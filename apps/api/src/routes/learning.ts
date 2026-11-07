import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Router } from 'express';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { LEARNING_VOLUMES } from '@titanapt/shared';
import type { LearningVolumeDefinition } from '@titanapt/shared';
import { z } from 'zod';
import { asyncHandler, badRequest, parseBody } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../prisma.js';

type ChapterIndexEntry = {
  key: string;
  title: string;
  page: number;
  excerpt: string;
  topicSlug: string | null;
};

type VolumeIndexEntry = LearningVolumeDefinition & {
  chapters: ChapterIndexEntry[];
  warnings: string[];
};

const volumeIndex = new Map<string, Promise<VolumeIndexEntry>>();

const volumeTwoSections = [
  '1. How to use this volume',
  '2. Core arithmetic applications',
  '2.1. Ratio and Proportion',
  '2.2. Average',
  '2.3. Profit and Loss',
  '2.4. Discount',
  '2.5. Simple Interest',
  '2.6. Compound Interest',
  '2.7. Problems on Ages',
  '2.8. Partnership',
  '2.9. Mixtures and Alligation',
  '3. Time-based problems',
  '3.1. Time and Work',
  '3.2. Pipes and Cisterns',
  '3.3. Time, Speed and Distance',
  '3.4. Problems on Trains',
  '3.5. Boats and Streams',
  '4. Advanced mathematics',
  '4.1. Algebra',
  '4.2. Indices and Surds',
  '4.3. Logarithms',
  '4.4. Arithmetic Progression',
  '4.5. Geometric Progression',
  '4.6. Permutation and Combination',
  '4.7. Probability',
  '4.8. Set Theory',
  '4.9. Geometry',
  '4.10. Mensuration',
  '4.11. Coordinate Geometry',
  '4.12. Trigonometry',
  '4.13. Heights and Distances',
  '5. Data Interpretation and Data Sufficiency',
  '6. Number Series, Clocks, Calendars, Races and Games, Stocks and Shares',
  '7. Formula quick-reference sheet',
  '8. Mental calculation handbook',
  '9. Study Plan, Challenge, and Progress Tracking',
  '10. Mixed Placement Mini-Test',
  '11. Coverage and quality-assurance report',
];

const volumeTwoFallbackPages: Map<string, number> = new Map([
  ['2. Core arithmetic applications', 5],
  ['3. Time-based problems', 38],
  ['4. Advanced mathematics', 53],
  ['5. Data Interpretation and Data Sufficiency', 92],
  ['6. Number Series, Clocks, Calendars, Races and Games, Stocks and Shares', 98],
  ['9. Study Plan, Challenge, and Progress Tracking', 117],
]);

function flattenOutline(items: unknown[]): Array<{ title: string; destination: unknown }> {
  const entries: Array<{ title: string; destination: unknown }> = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { title?: unknown; dest?: unknown; items?: unknown };
    if (typeof item.title === 'string') entries.push({ title: item.title, destination: item.dest });
    if (Array.isArray(item.items)) entries.push(...flattenOutline(item.items));
  }
  return entries;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function normalizeText(value: string): string {
  return value.normalize('NFKD').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

async function workspaceRoot(): Promise<string> {
  let directory = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      await readFile(path.join(directory, 'prisma', 'schema.prisma'));
      return directory;
    } catch {
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  throw new Error('Could not locate the TitanApt project root for the learning PDFs.');
}

function standardFontPath(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    return `${path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')}${path.sep}`;
  } catch {
    return undefined;
  }
}

async function pageText(document: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items
    .filter((item): item is typeof item & { str: string } => 'str' in item)
    .map((item) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveOutlinePage(document: PDFDocumentProxy, destination: unknown): Promise<number | null> {
  let resolved = destination;
  if (typeof resolved === 'string') resolved = await document.getDestination(resolved);
  if (!Array.isArray(resolved) || !resolved[0]) return null;
  const reference = resolved[0];
  if (!reference || typeof reference !== 'object' || !('num' in reference)) return null;
  return (await document.getPageIndex(reference as { num: number; gen: number })) + 1;
}

async function locateVolumeTwoPage(document: PDFDocumentProxy, title: string, fallbackPage: number | null): Promise<number | null> {
  const normalizedTitle = normalizeText(title.replace(/^\d+(?:\.\d+)*\.\s*/, ''));
  if (normalizedTitle.length >= 6) {
    for (let pageNumber = 4; pageNumber <= document.numPages; pageNumber += 1) {
      const text = normalizeText(await pageText(document, pageNumber));
      if (text.includes(normalizedTitle)) return pageNumber;
    }
  }
  return fallbackPage && fallbackPage >= 4 && fallbackPage <= document.numPages ? fallbackPage : null;
}

function matchedTopic(title: string, topics: Array<{ slug: string; name: string }>): string | null {
  const normalizedTitle = normalizeText(title.replace(/^(?:chapter\s*)?\d+(?:\.\d+)*[:.\s-]*/i, ''));
  const exact = topics.find((topic) => normalizeText(topic.name) === normalizedTitle);
  return exact?.slug ?? null;
}

/** Candidate source locations for a volume PDF, checked in order. The
 *  bundled web copy is the last-resort guarantee so the Hub can always index. */
function volumeSourceCandidates(root: string, volume: LearningVolumeDefinition): string[] {
  const resourceFile = volume.resourceUrl.split('/').pop() ?? `volume-${volume.slug}.pdf`;
  return [
    path.join(root, ...volume.sourcePath.split('/')),
    path.join(root, ...volume.referencePath.split('/')),
    path.join(root, 'apps', 'web', 'public', 'resources', resourceFile),
    path.join(root, 'apps', 'web', 'dist', 'resources', resourceFile),
  ];
}

async function resolveVolumeSource(root: string, volume: LearningVolumeDefinition): Promise<{ filePath: string; warning: string | null }> {
  const candidates = volumeSourceCandidates(root, volume);
  for (const filePath of candidates) {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return {
        filePath,
        warning: filePath === candidates[0] ? null : `Indexed from ${path.relative(root, filePath)}.`,
      };
    } catch {
      // try the next location
    }
  }
  throw new Error(`No readable PDF for ${volume.title}. Checked: ${candidates.join('; ')}`);
}

async function buildVolumeIndex(volumeSlug: string): Promise<VolumeIndexEntry> {
  const volume = LEARNING_VOLUMES.find((entry) => entry.slug === volumeSlug);
  if (!volume) throw new Error(`Unknown learning volume "${volumeSlug}".`);
  const root = await workspaceRoot();
  const { filePath, warning } = await resolveVolumeSource(root, volume);
  const warnings: string[] = warning ? [warning] : [];
  const data = new Uint8Array(await readFile(filePath));
  const document = await getDocument({
    data,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: standardFontPath(),
  }).promise;

  try {
    if (document.numPages !== volume.pageCount) {
      // Recording the real count beats failing the whole Hub over a mismatch.
      warnings.push(`Page count ${document.numPages} differs from the audited ${volume.pageCount}.`);
    }

    const outline = await document.getOutline();
    const chapters: Array<{ title: string; page: number }> = [];
    if (volume.slug === 'volume-2') {
      for (const entry of volumeTwoSections) {
        const page = await locateVolumeTwoPage(document, entry, volumeTwoFallbackPages.get(entry) ?? null);
        if (page) chapters.push({ title: entry, page });
      }
      if (chapters.length < volumeTwoSections.length) {
        warnings.push(
          `Volume 2 chapter index is incomplete: found ${chapters.length} of ${volumeTwoSections.length} contents entries.`,
        );
      }
    } else if (outline) {
      for (const entry of flattenOutline(outline)) {
        const page = await resolveOutlinePage(document, entry.destination);
        if (page !== null) chapters.push({ title: entry.title, page });
      }
    }

    if (chapters.length === 0) {
      warnings.push('No readable chapter outline was found; only the source PDF is available for this volume.');
    }

    const topics = await prisma.topic.findMany({ select: { slug: true, name: true } });
    const deduplicated = chapters.filter(
      (chapter, index) =>
        chapters.findIndex(
          (other) => other.page === chapter.page && normalizeText(other.title) === normalizeText(chapter.title),
        ) === index,
    );
    const indexed: ChapterIndexEntry[] = [];
    for (const [index, chapter] of deduplicated.entries()) {
      const text = await pageText(document, chapter.page);
      const titleIndex = text.toLowerCase().indexOf(chapter.title.replace(/^\d+(?:\.\d+)*[:.\s-]*/, '').toLowerCase());
      const excerptStart = titleIndex >= 0 ? titleIndex + chapter.title.length : 0;
      const excerpt = text.slice(excerptStart, excerptStart + 240).trim();
      indexed.push({
        key: `${String(index + 1).padStart(3, '0')}-${slugify(chapter.title) || 'section'}`,
        title: chapter.title,
        page: chapter.page,
        excerpt,
        topicSlug: matchedTopic(chapter.title, topics),
      });
    }
    return { ...volume, pageCount: document.numPages, warnings, chapters: indexed };
  } finally {
    await document.destroy();
  }
}

function getVolumeIndex(volumeSlug: string): Promise<VolumeIndexEntry> {
  let index = volumeIndex.get(volumeSlug);
  if (!index) {
    index = buildVolumeIndex(volumeSlug);
    volumeIndex.set(volumeSlug, index);
    void index.catch(() => volumeIndex.delete(volumeSlug));
  }
  return index;
}

export const learningRouter = Router();
learningRouter.use(requireAuth);

learningRouter.get(
  '/volumes',
  asyncHandler(async (req, res) => {
    // A single unreadable volume must not break the whole Hub; surface a
    // marked placeholder so the other seven volumes stay usable.
    const settled = await Promise.allSettled(LEARNING_VOLUMES.map((volume) => getVolumeIndex(volume.slug)));
    const volumes = settled.map((result, index) => {
      const volume = LEARNING_VOLUMES[index];
      if (result.status === 'fulfilled') return result.value;
      console.error(`[learning] volume index failed for ${volume.slug}:`, result.reason instanceof Error ? result.reason.message : result.reason);
      return {
        ...volume,
        warnings: [`This volume could not be indexed: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`],
        chapters: [] as ChapterIndexEntry[],
      };
    });
    const progress = await prisma.learningChapterProgress.findMany({
      where: { userId: req.user!.id },
      select: { volumeSlug: true, chapterKey: true },
    });
    const completed = new Set(progress.map((entry) => `${entry.volumeSlug}:${entry.chapterKey}`));
    res.json({
      data: volumes.map((volume) => ({
        ...volume,
        chapters: volume.chapters.map((chapter) => ({
          ...chapter,
          completed: completed.has(`${volume.slug}:${chapter.key}`),
        })),
      })),
    });
  }),
);

learningRouter.patch(
  '/progress',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        volumeSlug: z.string().regex(/^volume-[1-8]$/),
        chapterKey: z.string().min(1).max(120),
        completed: z.boolean(),
      }),
      req,
    );
    const volume = await getVolumeIndex(input.volumeSlug);
    if (!volume.chapters.some((chapter) => chapter.key === input.chapterKey)) {
      throw badRequest('INVALID_CHAPTER', 'That chapter is not part of this source volume.');
    }
    if (input.completed) {
      await prisma.learningChapterProgress.upsert({
        where: {
          userId_volumeSlug_chapterKey: {
            userId: req.user!.id,
            volumeSlug: input.volumeSlug,
            chapterKey: input.chapterKey,
          },
        },
        create: {
          userId: req.user!.id,
          volumeSlug: input.volumeSlug,
          chapterKey: input.chapterKey,
        },
        update: {},
      });
    } else {
      await prisma.learningChapterProgress.deleteMany({
        where: {
          userId: req.user!.id,
          volumeSlug: input.volumeSlug,
          chapterKey: input.chapterKey,
        },
      });
    }
    res.json({ data: { volumeSlug: input.volumeSlug, chapterKey: input.chapterKey, completed: input.completed } });
  }),
);
