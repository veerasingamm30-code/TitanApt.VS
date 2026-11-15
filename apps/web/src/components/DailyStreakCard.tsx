import type { CSSProperties } from 'react';
import { Flame, Quote, Target, TrendingUp } from 'lucide-react';

export type StreakSummary = {
  current: number;
  longest: number;
  today: string;
  todayActivityCount: number;
  todayQualified: boolean;
  qualifyCount: number;
  /** Verified correct Practice answers today (once per question, server-derived). */
  todayCorrectCount: number;
  /** Verified correct Practice answers needed today to light the flame. */
  flameActivationCount: number;
  weeklyActivity: Array<{ date: string; activityCount: number }>;
  rule: string;
};

export type StreakDay = {
  date: string;
  activityCount: number;
  qualified: boolean;
  minutes: number;
};

/** Reference-style hour caption, e.g. "2.4h" or "45m", from real focus minutes. */
function hoursLabel(minutes: number): string | null {
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function dayLetter(dateKey: string): string {
  // narrow weekday name for the learner's browser timezone; the server date
  // key is the account-calendar day, so compute the weekday deterministically
  // from the key itself (UTC noon) rather than from Date.now()
  const index = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return DAY_LETTERS[index];
}

function dayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
  return `${month} ${date.getUTCDate()}`;
}

/** Premium Daily Streak card (reference: Img-pdf/Streack.png). Seven rounded
 *  activity bars — swimming-pool green with a fade for qualified days, grey
 *  diagonal hatch for inactive days — plus the current-streak crown badge, a
 *  7-day goal progress bar and a motivational line. Every value comes from the
 *  same authoritative streak data the Progress page uses. */
export function DailyStreakCard({ streak, history }: { streak: StreakSummary; history: StreakDay[] }) {
  // the last seven account-local calendar days, Sunday..Saturday around today
  const byDate = new Map(history.map((day) => [day.date, day]));
  const days = streak.weeklyActivity.map(({ date, activityCount }) => ({
    date,
    activityCount,
    minutes: byDate.get(date)?.minutes ?? 0,
    qualified: byDate.get(date)?.qualified ?? activityCount >= streak.qualifyCount,
  }));

  // The flame lights only after the activation threshold of verified correct
  // Practice answers today; both values come from the dashboard API, never
  // from client-side guesswork, so a refresh cannot fake progress.
  const flameLit = streak.todayCorrectCount >= streak.flameActivationCount;
  const flameHint = flameLit
    ? 'Flame lit — 4 or more verified correct practice answers today'
    : `Flame unlit — ${streak.todayCorrectCount} of ${streak.flameActivationCount} verified correct practice answers today`;

  const goalDays = weeklyGoalCount(days);
  const goalPercent = Math.min(100, Math.round((goalDays / 7) * 100));

  return (
    <section className="daily-streak-card" aria-label="Daily streak card">
      <header className="daily-streak-head">
        <div className="daily-streak-title">
          <span
            className={`daily-streak-flame ${flameLit ? 'is-lit' : 'is-dim'}`}
            title={flameHint}
            aria-label={flameHint}
            role="img"
          >
            <Flame size={26} />
          </span>
          <div>
            <h3>Daily <span className="streak-accent">Streak</span></h3>
            <p>Keep learning. Keep growing. Your future self will thank you!</p>
          </div>
        </div>
        <div className="streak-crown-badge" role="status">
          <span className="streak-crown" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M3 9l4 4 5-7 5 7 4-4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
            </svg>
          </span>
          <div>
            <small>Current Streak</small>
            <strong>{streak.current} Day{streak.current === 1 ? '' : 's'}</strong>
          </div>
        </div>
      </header>

      <div className="daily-streak-chart" role="img" aria-label="Seven day learning activity chart">
        {days.map((day) => {
          const isToday = day.date === streak.today;
          const dayStyles: CSSProperties = { '--bar-max': asBarMax(day.minutes) } as CSSProperties;
          return (
            <div
              key={day.date}
              className={`streak-pill-col ${day.qualified ? 'is-active' : 'is-idle'} ${isToday ? 'is-today' : ''}`}
              style={dayStyles}
              title={
                `${dayLabel(day.date)} — ` +
                (day.qualified
                  ? `${day.activityCount} practice answers · streak day`
                  : day.activityCount > 0
                    ? `${day.activityCount} verified activities (${streak.qualifyCount} needed)`
                    : 'no qualifying activity yet') +
                (day.minutes ? ` · ${day.minutes} focus min` : '')
              }
            >
              {isToday && day.minutes > 0 && (
                <span className="streak-pill-badge">{hoursLabel(day.minutes)}</span>
              )}
              <span className="streak-pill">
                <span className="streak-pill-fill" />
              </span>
              <span className="streak-pill-letter">{dayLetter(day.date)}</span>
              <span className="streak-pill-date">{dayLabel(day.date)}</span>
            </div>
          );
        })}
      </div>

      <footer className="daily-streak-foot">
        <div className="streak-goal" aria-label="Seven day goal progress">
          <span className="streak-goal-icon" aria-hidden><Target size={22} /></span>
          <span className="streak-goal-label">7 Day Goal</span>
          <span className="streak-goal-count">{goalDays}<em>/7</em></span>
        </div>
        <div className="streak-goal-bar" aria-hidden>
          <span style={{ width: `${goalPercent}%` }} />
        </div>
        <div className="streak-quote">
          <Quote size={13} aria-hidden />
          <span>{streak.todayQualified ? 'Momentum day. Keep the chain alive tomorrow.' : 'Small steps every day lead to big results.'}</span>
          <TrendingUp size={16} aria-hidden className="streak-quote-arrow" />
        </div>
      </footer>
    </section>
  );
}

/** Weekly goal = qualifying days out of the 7 shown. Today already counts as
 *  soon as it qualifies — exactly the same rule the streak itself follows. */
function weeklyGoalCount(days: Array<{ qualified: boolean }>): number {
  return days.filter((day) => day.qualified).length;
}

function asBarMax(minutes: number): string {
  // tallest pillar is reached around 3.5 h of focused study that day
  const ratio = Math.max(0.18, Math.min(1, minutes / 210));
  return `${Math.round(ratio * 100)}%`;
}
