import type { CSSProperties } from 'react';

export type StreakDay = {
  date: string;
  correctCount: number;
  qualified: boolean;
  minutes: number;
};

export type StreakSummary = {
  current: number;
  longest: number;
  today: string;
  todayCorrect: number;
  todayQualified: boolean;
  qualifyCount: number;
  weeklyCorrect: Array<{ date: string; correctCount: number }>;
  rule: string;
};

const CHART_HEIGHT = 132;
const CHART_WIDTH = 640;
const BAR_GAP = 6;
const TOP_PADDING = 14;
const BOTTOM_PADDING = 22;

function shortDate(dateKey: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${dateKey}T12:00:00`));
}

function dayLetter(dateKey: string): string {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'narrow' }).format(new Date(`${dateKey}T12:00:00`));
}

/** Professional practice-streak chart: one vertical bar per local calendar
 *  day over the fetched window, with a qualification threshold line. A day
 *  qualifies for the streak when the correct-practice count reaches the
 *  server's `qualifyCount` (4). */
export function StreakChart({ streak, history }: { streak: StreakSummary; history: StreakDay[] }) {
  const days = [...history].slice(-30);
  const maxCount = Math.max(streak.qualifyCount + 1, ...days.map((day) => day.correctCount));
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const barWidth = Math.max(6, (CHART_WIDTH - BAR_GAP * (days.length - 1)) / days.length);
  const scale = (count: number) => (count / maxCount) * plotHeight;
  const thresholdY = CHART_HEIGHT - BOTTOM_PADDING - scale(streak.qualifyCount);
  const barAreaWidth = CHART_WIDTH;

  return (
    <figure className="streak-chart" aria-label="Practice streak progress chart">
      <figcaption className="streak-chart-head">
        <div>
          <span className="stat-label">Practice streak</span>
          <h3>
            {streak.current} day{streak.current === 1 ? '' : 's'} <span className="muted">current</span> · {streak.longest}{' '}
            <span className="muted">longest</span>
          </h3>
        </div>
        <div className={`streak-status ${streak.todayQualified ? 'is-qualified' : ''}`}>
          {streak.todayQualified ? (
            <>
              <strong>Today qualified</strong>
              <small>{streak.todayCorrect} correct practice answers</small>
            </>
          ) : (
            <>
              <strong>{streak.qualifyCount - streak.todayCorrect} more to qualify today</strong>
              <small>
                {streak.todayCorrect}/{streak.qualifyCount} correct practice answers so far
              </small>
            </>
          )}
        </div>
      </figcaption>

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="streak-chart-svg" role="img" preserveAspectRatio="none">
        {/* qualification threshold */}
        <line
          x1={0}
          x2={barAreaWidth}
          y1={thresholdY}
          y2={thresholdY}
          className="streak-threshold"
          strokeDasharray="5 5"
        />
        <text x={2} y={Math.max(10, thresholdY - 4)} className="streak-threshold-label">
          streak day = {streak.qualifyCount} correct
        </text>
        {days.map((day, index) => {
          const height = Math.max(day.correctCount > 0 ? 4 : 2, scale(day.correctCount));
          const x = index * (barWidth + BAR_GAP);
          const isToday = day.date === streak.today;
          const y = CHART_HEIGHT - BOTTOM_PADDING - height;
          const label = `${shortDate(day.date)} — ${day.qualified ? `${day.correctCount} correct · streak day` : day.correctCount > 0 ? `${day.correctCount} correct · not yet a streak day` : 'no correct practice answers'}${day.minutes ? ` · ${day.minutes} focus min` : ''}`;
          return (
            <g key={day.date} className={`streak-bar ${day.qualified ? 'qualified' : day.correctCount > 0 ? 'partial' : 'empty'} ${isToday ? 'today' : ''}`}>
              <title>{label}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={Math.min(3, barWidth / 3)}
              />
            </g>
          );
        })}
        {/* date ticks */}
        {days
          .map((day, index) => ({ day, index }))
          .filter(({ day }, index) => day.date === streak.today || index === days.length - 1 || index % 7 === 0)
          .map(({ day, index }) => (
            <text key={day.date} x={index * (barWidth + BAR_GAP) + barWidth / 2} y={CHART_HEIGHT - 6} textAnchor={index === 0 ? 'start' : 'middle'} className="streak-tick">
              {shortDate(day.date)}
            </text>
          ))}
      </svg>

      <div className="streak-week" aria-label="Weekly practice progress">
        {streak.weeklyCorrect.map((day) => {
          const isToday = day.date === streak.today;
          const style: CSSProperties = { '--streak-day-fill': `${Math.min(100, (day.correctCount / streak.qualifyCount) * 100)}%` } as CSSProperties;
          return (
            <div key={day.date} className={`streak-week-day ${isToday ? 'today' : ''} ${day.correctCount >= streak.qualifyCount ? 'qualified' : ''}`} style={style}>
              <span className="streak-week-fill" />
              <small>{dayLetter(day.date)}</small>
              <strong>{day.correctCount}</strong>
            </div>
          );
        })}
      </div>

      <details className="streak-rule">
        <summary>How practice streaks work</summary>
        <p>{streak.rule}</p>
      </details>
    </figure>
  );
}
