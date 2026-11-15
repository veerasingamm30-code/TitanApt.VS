import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Target, Flame, Clock3, Calendar } from 'lucide-react';
import type { StudySessionView, StudyTodayView, StudyHistorySummary } from '@titanapt/shared';
import { apiData, messageFromError } from '../lib/api';
import { useDocumentTitle } from '../lib/useApi';
import { ErrorState, Loader, PageHeader, ProgressBar, SectionHead } from '../components/ui';

type TodayResponse = StudyTodayView & { resumed?: boolean };

const TARGET_PRESETS = [15, 25, 45, 60];

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function formatHours(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function CrackTimePage() {
  useDocumentTitle('Crack Time');
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [history, setHistory] = useState<StudyHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [draftTarget, setDraftTarget] = useState<string>('');
  const [targetPicked, setTargetPicked] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.dataset.studyTimer = '1';
    return () => {
      delete document.body.dataset.studyTimer;
    };
  }, []);

  const loadHistory = useCallback(() => {
    apiData<StudyHistorySummary>('/api/study/history?days=120')
      .then(setHistory)
      .catch(() => setHistory(null));
  }, []);

  const loadToday = useCallback(
    async (isRetry = false) => {
      if (!isRetry) setLoading(true);
      setError(null);
      try {
        const data = await apiData<TodayResponse>('/api/study/today');
        setToday(data);
        setDraftTarget(String(data.targetMinutes));
        setTargetPicked(false);
      } catch (err) {
        setError(messageFromError(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadToday();
    loadHistory();
  }, [loadToday, loadHistory]);

  const session = today?.inProgress ?? null;
  const isActive = session?.status === 'ACTIVE';
  const isPaused = session?.status === 'PAUSED';
  const secondsLive = isActive && session
    ? session.accumulatedSeconds + Math.max(0, Math.floor((now - new Date(session.lastActiveAt).getTime()) / 1000))
    : (session?.accumulatedSeconds ?? 0);

  const secondsToday = today?.secondsToday ?? (session ? session.accumulatedSeconds : 0);

  // local ticking clock while a session is active
  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  // server heartbeat every 60s while active
  const heartbeat = useCallback(async () => {
    try {
      const data = await apiData<TodayResponse>('/api/study/heartbeat', { method: 'POST' });
      setToday(data);
    } catch {
      // a missed heartbeat is retried on the next tick; the server caps credits
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void heartbeat();
    heartbeatRef.current = window.setInterval(() => void heartbeat(), 60_000);
    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, [isActive, heartbeat]);

  async function action(kind: 'start' | 'pause' | 'resume' | 'stop') {
    setBusy(true);
    setActionError(null);
    try {
      const data = await apiData<TodayResponse>(`/api/study/${kind}`, { method: 'POST' });
      setToday(data);
      setNow(Date.now());
      if (kind === 'stop') loadHistory();
    } catch (err) {
      setActionError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveTarget(raw: string | number) {
    const value = typeof raw === 'number' ? raw : Math.round(Number(raw));
    if (Number.isNaN(value) || value <= 0) {
      setTargetError('Enter a whole number of minutes, for example 35.');
      return;
    }
    if (value < 5 || value > 480) {
      setTargetError('Target must be between 5 and 480 minutes.');
      return;
    }
    setBusy(true);
    setActionError(null);
    setTargetError(null);
    try {
      const data = await apiData<TodayResponse>('/api/study/target', { method: 'PATCH', body: { minutes: value } });
      setToday(data);
      setDraftTarget(String(data.targetMinutes));
      setTargetPicked(false);
    } catch (err) {
      setTargetError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader label="Opening Crack Time" />;
  if (error || !today) return <ErrorState message={error ?? 'Crack Time is unavailable.'} onRetry={() => void loadToday(true)} />;

  const targetSeconds = today.targetMinutes * 60;
  const percent = targetSeconds > 0 ? Math.min(100, (secondsToday / targetSeconds) * 100) : 0;
  const targetMet = secondsToday >= targetSeconds;
  const openStatus = session ? (isActive ? 'Focusing' : 'Paused') : null;

  return (
    <div>
      <PageHeader
        eyebrow="Crack Time"
        title="One focused sprint. One problem at a time."
        subtitle="Track real study minutes. The timer keeps running server-side: pause when you step away and resume anywhere. Idle time is never padded — only actual active time counts."
        actions={
          session ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void action(isActive ? 'pause' : 'resume')}>
              {isActive ? <><Pause size={16} /> Pause timer</> : <><Play size={16} /> Resume timer</>}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void action('start')}>
              <Play size={16} /> Start focused sprint
            </button>
          )
        }
      />

      {actionError && <div className="form-error" role="alert">{actionError}</div>}

      <section className="study-today-grid">
        <article className="panel study-timer-card">
          <div className="study-timer-top">
            <span className="pill pill-light"><Clock3 size={14} /> {today.dayKey}</span>
            {openStatus && <span className={`pill ${isActive ? 'pill-live' : 'pill-muted'}`}>{openStatus}</span>}
          </div>
          <div className="study-clock" aria-live="polite">{formatClock(secondsLive)}</div>
          <div className="study-session-status">
            {!session && <small>Ready when you are.</small>}
            {session && (
              <small>
                Session {new Date(session.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ·
                {' '}credited {formatHours(session.accumulatedSeconds)}
              </small>
            )}
          </div>
          <div className="study-timer-actions">
            {!session && (
              <button type="button" className="btn btn-accent" disabled={busy} onClick={() => void action('start')}>
                <Play size={16} /> Start
              </button>
            )}
            {isActive && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void action('pause')}>
                <Pause size={16} /> Pause
              </button>
            )}
            {isPaused && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void action('resume')}>
                <Play size={16} /> Resume
              </button>
            )}
            {session && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void action('stop')}>
                <Square size={16} /> Finish session
              </button>
            )}
          </div>
          <p className="form-footnote">Leaving this page or closing the tab pauses credit automatically after a short idle window. The server, not the tab, decides what counts — refresh-proof and cheat-resistant.</p>
        </article>

        <article className="panel study-target-card">
          <div className="section-title-row">
            <h3><Target size={17} /> Today’s target</h3>
            {targetMet && <span className="badge badge-success"><Flame size={13} /> Target met</span>}
          </div>
          <div className="study-target-progress">
            <ProgressBar value={secondsToday} max={targetSeconds} />
            <div className="study-target-figures">
              <strong>{formatHours(secondsToday)}</strong>
              <span className="muted">of {today.targetMinutes} min goal</span>
              <span className="muted study-target-remaining">
                {targetMet ? 'Goal reached for today' : `${formatHours(Math.max(0, targetSeconds - secondsToday))} left to goal`}
              </span>
            </div>
          </div>
          <div className="study-sessions-list">
            <SectionHead title="Sessions today" />
            {today.sessions.length === 0 ? (
              <p className="muted">No sessions yet today.</p>
            ) : (
              today.sessions.map((row: StudySessionView) => (
                <div className="study-session-row" key={row.id}>
                  <span className={`session-dot dot-${row.status.toLowerCase()}`} />
                  <span>
                    {new Date(row.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {' '}– {row.status === 'ENDED' && row.endedAt ? new Date(row.endedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : row.status.toLowerCase()}
                  </span>
                  <strong>{formatHours(row.accumulatedSeconds)}</strong>
                </div>
              ))
            )}
          </div>
          <div className="field">
            <span>Daily target (minutes)</span>
            <div className="field-choice-row">
              <select value={targetPicked ? 'custom' : TARGET_PRESETS.includes(today.targetMinutes) ? String(today.targetMinutes) : ''} onChange={(e) => { setTargetError(null); if (e.target.value === 'custom') setTargetPicked(true); else { setTargetPicked(false); void saveTarget(Number(e.target.value)); } }} disabled={busy} aria-label="Daily target minutes">
                {TARGET_PRESETS.map((value) => <option key={value} value={value}>{value} min</option>)}
                <option value="custom">Custom…</option>
              </select>
              {(targetPicked || !TARGET_PRESETS.includes(today.targetMinutes)) && (
                <div className="custom-target-input">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={draftTarget ?? String(today.targetMinutes)}
                    onChange={(e) => { setDraftTarget(e.target.value); setTargetError(null); }}
                    onBlur={(e) => { const value = e.target.value.trim(); if (value && Number(value) !== today.targetMinutes) void saveTarget(value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveTarget(draftTarget); } }}
                    aria-label="Custom target minutes"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void saveTarget(draftTarget)}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
            {targetError
              ? <small className="field-error" role="alert">{targetError}</small>
              : <small className="field-help">Saved to your profile; 5–480 minutes. Press Apply or Enter.</small>}
          </div>
        </article>
      </section>

      {history && (
        <section className="panel study-history-card">
          <div className="section-title-row">
            <h3><Calendar size={17} /> Study history</h3>
            <span className="muted">Weekly and monthly view · total {formatHours(history.totalTimeMinutes * 60)}</span>
          </div>
          <div className="study-history-columns">
            <div>
              <span className="streak-history-label">Last 8 weeks</span>
              <div className="study-bars" role="list" aria-label="Weekly study minutes">
                {[...history.weekly].slice(-8).map((week) => {
                  const total = week.secondsTotal / (week.targetMinutes * 60 || 1);
                  return (
                    <div className="study-bar" role="listitem" key={week.weekKey} title={`Week of ${week.weekStart}: ${formatHours(week.secondsTotal)}`}>
                      <span className="study-bar-fill" style={{ height: `${Math.min(100, total * 100)}%` }} />
                    </div>
                  );
                })}
              </div>
              <span className="muted">Bars show minutes versus that week’s target.</span>
            </div>
            <div>
              <span className="streak-history-label">Last 6 months</span>
              <div className="study-bars" role="list" aria-label="Monthly study minutes">
                {[...history.monthly].slice(-6).map((month) => {
                  const total = month.secondsTotal / (60 * 30);
                  return (
                    <div className="study-bar" role="listitem" key={month.monthKey} title={`${month.monthKey}: ${formatHours(month.secondsTotal)}`}>
                      <span className="study-bar-fill" style={{ height: `${Math.min(100, total * 100)}%` }} />
                    </div>
                  );
                })}
              </div>
              <span className="muted">Bars show average daily focus minutes.</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
