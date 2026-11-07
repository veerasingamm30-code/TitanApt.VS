import type { User, UserProfile } from '@prisma/client';
import type { AccentColor, PublicUser, ThemeMode } from '@titanapt/shared';

export function serializeUser(user: User & { profile: UserProfile | null }): PublicUser {
  return {
    id: user.id,
    email: user.emailOriginal,
    displayName: user.profile?.displayName ?? 'Learner',
    role: user.role,
    timezone: user.profile?.timezone ?? 'Asia/Kolkata',
    theme: (user.profile?.theme ?? 'dark') as ThemeMode,
    accent: (user.profile?.accent ?? 'orange') as AccentColor,
    avatarUrl: user.profile?.avatarPath ? '/api/auth/avatar' : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeCompany(company: {
  id: string;
  slug: string;
  name: string;
  initials: string;
  overview: string;
  headquarters: string | null;
  website: string | null;
  founded: string | null;
  parent: string | null;
  mainBusiness: string | null;
  industries: string | null;
  technology: string | null;
  platforms: string | null;
  careersUrl: string | null;
  logoSource: string | null;
  logoStatus: string;
  sourceNote: string;
  verifiedAt: Date;
  topicSlugs: string[];
}) {
  return {
    ...company,
    verifiedAt: company.verifiedAt.toISOString().slice(0, 10),
  };
}
