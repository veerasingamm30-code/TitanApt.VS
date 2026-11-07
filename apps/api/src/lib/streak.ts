// Streak-day persistence: one record per user + day, preventing duplicates.
import { prisma } from '../prisma.js';
import { dayKey } from './metrics.js';

export type StreakSource = 'practice' | 'lesson' | 'mock' | 'study';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

function profileTimezone(timezone?: string): string {
  return timezone || DEFAULT_TIMEZONE;
}

/**
 * Records a genuine learning/practice activity day for the streak history.
 * Safe to call repeatedly: a unique (userId, dayKey) row is upserted.
 */
export async function touchStreakDay(
  userId: string,
  timezone: string | undefined,
  source: StreakSource,
  date = new Date(),
): Promise<void> {
  const key = dayKey(date, profileTimezone(timezone));
  const createField =
    source === 'practice' ? { solvedCount: 1 } :
    source === 'mock' ? { mocksCount: 1 } :
    { lessonsCount: 1 };
  const updateField =
    source === 'practice' ? { solvedCount: { increment: 1 } } :
    source === 'mock' ? { mocksCount: { increment: 1 } } :
    { lessonsCount: { increment: 1 } };
  try {
    await prisma.streakDay.upsert({
      where: { userId_dayKey: { userId, dayKey: key } },
      create: {
        userId,
        dayKey: key,
        ...createField,
        minutes: source === 'study' ? 1 : 0,
      },
      update: updateField,
    });
  } catch {
    // ignore duplicate-race failures; the record already exists
  }
}

export async function touchStreakStudyMinutes(userId: string, timezone: string | undefined, minutes: number, date = new Date()): Promise<void> {
  if (minutes <= 0) return;
  const key = dayKey(date, profileTimezone(timezone));
  try {
    await prisma.streakDay.upsert({
      where: { userId_dayKey: { userId, dayKey: key } },
      create: { userId, dayKey: key, minutes },
      update: { minutes: { increment: minutes } },
    });
  } catch {
    // ignore duplicate-race failures
  }
}
