import { describe, expect, it } from 'vitest';
import { buildVolumeIndexForTest } from '../routes/learning.js';
import { LEARNING_VOLUMES } from '@titanapt/shared';
import { prisma } from '../prisma.js';

/* Regression tests for the Learning Hub volume index rebuild.
 * Background: the volume-2 section locator used to re-scan the whole PDF for
 * every section title (37 sequential full scans), making a cold first request
 * take ~20 seconds and the page spin indefinitely in the browser. The repair
 * (single ordered pass + shared page-text cache + boot warm-up) must keep an
 * equivalent chapter set and land in a usable time budget. */

describe('learning volume index (cold rebuild)', () => {
  it('indexes volume-2 completely in one pass with reasonable latency', async () => {
    const t0 = Date.now();
    const volume = await buildVolumeIndexForTest('volume-2');
    const ms = Date.now() - t0;

    const sections = 37; // volumeTwoSections count
    expect(volume.chapters.length).toBeGreaterThanOrEqual(sections - 1); // 1 duplicate-merge tolerance
    expect(ms).toBeLessThan(10_000); // previously ~20s+ for the whole request
    // chapters must be ordered by their source page
    for (let i = 1; i < volume.chapters.length; i += 1) {
      expect(volume.chapters[i].page).toBeGreaterThanOrEqual(volume.chapters[i - 1].page);
    }
    // mapped topic links remain real topic slugs
    const topics = new Set((await prisma.topic.findMany({ select: { slug: true } })).map((t) => t.slug));
    for (const chapter of volume.chapters) {
      if (chapter.topicSlug) expect(topics.has(chapter.topicSlug)).toBe(true);
    }
  }, 60_000);

  it('indexes every declared volume with at least the PDF available', async () => {
    for (const volume of LEARNING_VOLUMES) {
      const entry = await buildVolumeIndexForTest(volume.slug);
      expect(entry.slug).toBe(volume.slug);
      expect(entry.pageCount).toBeGreaterThan(0);
    }
  }, 120_000);
});
