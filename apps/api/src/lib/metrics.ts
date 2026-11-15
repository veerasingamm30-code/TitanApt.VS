export function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function accuracy(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return roundOne((correct / total) * 100);
}

export function percentage(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return roundOne((score / maxScore) * 100);
}

export type MarkingScheme = { correct: number; incorrect: number; unanswered: number };

export function scoreAnswers(
  questions: Array<{ selectedOptionId: string | null; correctOptionId: string | null }>,
  marking: MarkingScheme,
) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  for (const q of questions) {
    if (!q.selectedOptionId) unanswered += 1;
    else if (q.correctOptionId && q.selectedOptionId === q.correctOptionId) correct += 1;
    else incorrect += 1;
  }
  const raw = correct * marking.correct + incorrect * marking.incorrect + unanswered * marking.unanswered;
  const score = Math.max(0, Math.round(raw));
  const maxScore = Math.max(0, Math.round(questions.length * marking.correct));
  return {
    correct,
    incorrect,
    unanswered,
    score,
    maxScore,
    percentage: percentage(score, maxScore),
  };
}

export function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftDayKey(key: string, deltaDays: number): string {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/** A local calendar day qualifies after one completed, verified learning or practice activity. */
export const ACTIVITY_QUALIFY_COUNT = 1;

/**
 * Visual flame-activation threshold for the dashboard Daily Streak card only.
 * The flame lights up after this many VERIFIED correct answers today in the
 * Practice section. This deliberately does NOT change the streak-day rule
 * (ACTIVITY_QUALIFY_COUNT) or any historical streak record: streak days keep
 * qualifying after a single verified activity, the flame is a brighter
 * "today's practice is warmed up" signal on top of that.
 */
export const FLAME_ACTIVATION_CORRECT_COUNT = 4;

/** Streaks derive from the per-day count of unique verified activities. */
export function activityStreakFromDays(
  days: Map<string, number>,
  today: string | null,
): { current: number; longest: number } {
  const qualified = (key: string) => (days.get(key) ?? 0) >= ACTIVITY_QUALIFY_COUNT;
  const sorted = [...days.entries()].filter(([, count]) => count >= ACTIVITY_QUALIFY_COUNT).map(([key]) => key).sort();

  let longest = 0;
  let running = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    running = previous && shiftDayKey(previous, 1) === day ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = day;
  }

  if (!today) return { current: 0, longest };
  let cursor = qualified(today) ? today : shiftDayKey(today, -1);
  if (!qualified(cursor)) return { current: 0, longest };
  let current = 0;
  while (qualified(cursor)) {
    current += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return { current, longest };
}

/**
 * Current streak: if the learner was active today, count back from today.
 * If not active today but active yesterday, count back from yesterday.
 * The rule is shown on the dashboard.
 */
export function calculateStreak(activityDates: Date[], timezone: string, now = new Date()): number {
  const days = new Set(activityDates.map((date) => dayKey(date, timezone)));
  const today = dayKey(now, timezone);
  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

export function calculateLongestStreak(activityDates: Date[], timezone: string): number {
  const days = [...new Set(activityDates.map((date) => dayKey(date, timezone)))].sort();
  let longest = 0;
  let current = 0;
  let previous: string | null = null;
  for (const day of days) {
    current = previous && shiftDayKey(previous, 1) === day ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

export function isWeakArea(attempts: number, topicAccuracy: number | null, minAttempts: number, threshold: number): boolean {
  return attempts >= minAttempts && topicAccuracy !== null && topicAccuracy < threshold;
}

export function lowerDifficulty(recentDifficulties: string[]): 'EASY' | 'MEDIUM' | 'HARD' {
  if (recentDifficulties.filter((d) => d === 'EASY').length >= recentDifficulties.length / 2) return 'EASY';
  if (recentDifficulties.filter((d) => d === 'HARD').length >= recentDifficulties.length / 2) return 'MEDIUM';
  return 'EASY';
}
