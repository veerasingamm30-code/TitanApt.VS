import { Router } from 'express';
import type { Company } from '@prisma/client';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/errors.js';

export const publicRouter = Router();

/** Public company profile fields for the pre-login landing marquee. Only
 *  approved content that is already public in the workspace is exposed — no
 *  user data, marks, or learner statistics are returned here. `mockSlug` is
 *  present only when a real published company mock exists for that company. */
function publicCompanyView(company: Company, mockSlug: string | null) {
  return {
    slug: company.slug,
    name: company.name,
    initials: company.initials,
    overview: company.overview,
    website: company.website,
    headquarters: company.headquarters,
    founded: company.founded,
    mainBusiness: company.mainBusiness,
    industries: company.industries,
    logoUrl: `/company-logos/${company.slug}.png`,
    logoStatus: company.logoStatus,
    sourceNote: company.sourceNote,
    mockSlug,
  };
}

publicRouter.get(
  '/companies',
  asyncHandler(async (_req, res) => {
    const companies = await prisma.company.findMany({ orderBy: { order: 'asc' } });
    const publishedMockSlugs = new Set(
      (await prisma.mockTest.findMany({
        where: { status: 'PUBLISHED', slug: { startsWith: 'company-mock-' } },
        select: { slug: true },
      })).map((mock) => mock.slug),
    );
    res.json({
      data: companies.map((company) =>
        publicCompanyView(
          company,
          publishedMockSlugs.has(`company-mock-${company.slug}`) ? `company-mock-${company.slug}` : null,
        ),
      ),
    });
  }),
);
