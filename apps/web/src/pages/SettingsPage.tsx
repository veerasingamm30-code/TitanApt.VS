import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, ImageUp, LogOut, Mail, Moon, Palette, Save, ShieldCheck, Sun, Trash2, UserRound } from 'lucide-react';
import type { AccentColor, ThemeMode } from '@titanapt/shared';
import { accentOptions, applyTheme, themeOptions } from '../lib/theme';
import { apiData, messageFromError, uploadAvatar } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../lib/useApi';
import { PageHeader, SectionHead } from '../components/ui';
import { formatDate } from '../lib/format';

const timezones = [
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

export function SettingsPage() {
  useDocumentTitle('Settings');
  const { user, refresh, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Asia/Kolkata');
  const [dailyGoal, setDailyGoal] = useState(10);
  const [studyTargetMinutes, setStudyTargetMinutes] = useState(25);
  const [theme, setTheme] = useState<ThemeMode>(user?.theme ?? 'dark');
  const [accent, setAccent] = useState<AccentColor>(user?.accent ?? 'orange');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarStamp, setAvatarStamp] = useState(() => Date.now());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setTimezone(user.timezone);
    setTheme(user.theme);
    setAccent(user.accent);
  }, [user]);

  useEffect(() => {
    apiData<{ dailyGoal: { goal: number }; user: { studyTargetMinutes: number } }>('/api/dashboard')
      .then((data) => {
        setDailyGoal(data.dailyGoal.goal);
        setStudyTargetMinutes(data.user.studyTargetMinutes);
      })
      .catch(() => undefined);
  }, []);

  if (!user) return null;
  const timezoneOptions = timezones.includes(user.timezone) ? timezones : [user.timezone, ...timezones];
  const currentAvatar = user.avatarUrl;

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Choose an image under 4 MB.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Choose a PNG, JPEG, WebP or GIF image.');
      return;
    }
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setAvatarBusy(true);
    setError(null);
    try {
      await uploadAvatar(file);
      await refresh();
      setSaved(false);
      setAvatarStamp(Date.now());
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setAvatarBusy(false);
      URL.revokeObjectURL(preview);
      setPreviewUrl(null);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setError(null);
    try {
      await apiData('/api/auth/avatar', { method: 'DELETE' });
      await refresh();
      setAvatarStamp(Date.now());
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiData('/api/auth/profile', {
        method: 'PATCH',
        body: { displayName: displayName.trim(), timezone, dailyGoal, theme, accent, studyTargetMinutes },
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account settings"
        title="Make the workspace fit your study rhythm."
        subtitle="Tune your appearance, local timezone and daily question goal. Preferences are saved to your account."
      />

      <div className="settings-layout">
        <form className="panel settings-form" onSubmit={save}>
          <SectionHead title="Profile and study plan" />
          {error && <div className="form-error" role="alert">{error}</div>}
          {saved && <div className="form-success" role="status"><CheckCircle2 size={17} /> Settings saved.</div>}

          <label className="field">
            <span><UserRound size={15} /> Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => { setDisplayName(event.target.value); setSaved(false); }}
              minLength={2}
              maxLength={60}
              required
            />
            <small className="field-help">Used in the sidebar and dashboard greeting.</small>
          </label>

          <label className="field">
            <span><Mail size={15} /> Email address</span>
            <input type="email" value={user.email} readOnly />
            <small className="field-help">Email changes are not available in this local build.</small>
          </label>

          <div className="form-row">
            <label className="field">
              <span><Clock3 size={15} /> Timezone</span>
              <select value={timezone} onChange={(event) => { setTimezone(event.target.value); setSaved(false); }}>
                {timezoneOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
              <small className="field-help">Used for streaks and the local-day goal.</small>
            </label>
            <label className="field">
              <span>Daily question goal</span>
              <input
                type="number"
                min={5}
                max={100}
                value={dailyGoal}
                onChange={(event) => { setDailyGoal(Number(event.target.value)); setSaved(false); }}
                required
              />
              <small className="field-help">Between 5 and 100 questions per day.</small>
            </label>
          </div>

          <label className="field">
            <span>Crack Time daily target (minutes)</span>
            <input
              type="number"
              min={5}
              max={480}
              value={studyTargetMinutes}
              onChange={(event) => { setStudyTargetMinutes(Number(event.target.value)); setSaved(false); }}
              required
            />
            <small className="field-help">Same target as Crack Time (5–480 minutes). The dashboard shows your progress toward it.</small>
          </label>

          <div className="appearance-block">
            <div className="section-title-row">
              <h3><Palette size={17} /> Appearance</h3>
              <span className="muted">Applied instantly and saved with your profile.</span>
            </div>
            <div className="appearance-grid" role="radiogroup" aria-label="Theme">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.value}
                  className={`theme-option ${theme === option.value ? 'is-selected' : ''}`}
                  onClick={() => { setTheme(option.value); applyTheme(option.value, accent); setSaved(false); }}
                >
                  {option.value === 'dark' ? <Moon size={19} /> : <Sun size={19} />}
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </button>
              ))}
            </div>
            <div className="accent-row" role="radiogroup" aria-label="Accent colour">
              {accentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={accent === option.value}
                  className={`accent-option ${accent === option.value ? 'is-selected' : ''}`}
                  onClick={() => { setAccent(option.value); applyTheme(theme, option.value); setSaved(false); }}
                >
                  <span className="accent-swatch" style={{ background: option.color }} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary" disabled={saving || displayName.trim().length < 2}>
              {saving ? 'Saving…' : 'Save changes'} <Save size={16} />
            </button>
          </div>
        </form>

        <aside className="settings-aside">
          <div className="panel account-card">
            <span className="avatar avatar-large avatar-photo">
              {previewUrl ? (
                <img src={previewUrl} alt="New avatar preview" />
              ) : currentAvatar ? (
                <img src={`${currentAvatar}?v=${avatarStamp}`} alt={`${user.displayName} avatar`} />
              ) : (
                user.displayName.slice(0, 1).toUpperCase()
              )}
            </span>
            {previewUrl && <small className="field-help">Preview — uploading…</small>}
            <h2>{user.displayName}</h2>
            <p>{user.email}</p>
            <div className="avatar-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageUp size={15} /> {avatarBusy ? 'Uploading…' : currentAvatar ? 'Replace avatar' : 'Choose avatar'}
              </button>
              {currentAvatar && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                  <Trash2 size={15} /> Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => void chooseAvatar(event)}
              hidden
              aria-label="Upload avatar image"
            />
            <small className="field-help">Square images up to 4 MB (PNG, JPEG, WebP, GIF). Your avatar appears in the sidebar topbar.</small>
            <span className="badge badge-info">{user.role === 'ADMIN' ? 'Administrator' : user.role === 'REVIEWER' ? 'Reviewer' : 'Learner'}</span>
            <dl className="fact-list">
              <div><dt>Member since</dt><dd>{formatDate(user.createdAt)}</dd></div>
              <div><dt>Workspace</dt><dd>TitanApt local</dd></div>
              <div><dt>Data scope</dt><dd>Private to your account</dd></div>
            </dl>
            {(user.role === 'ADMIN' || user.role === 'REVIEWER') && (
              <Link to="/app/admin" className="btn btn-secondary btn-block">Open admin workspace <ArrowRight size={15} /></Link>
            )}
          </div>

          <div className="panel security-note">
            <ShieldCheck size={21} />
            <h3>Session security</h3>
            <p>You are signed in with an HttpOnly session cookie and a same-site request token. Password changes and account deletion are not included in this build.</p>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => void logout()}>
              <LogOut size={16} /> Sign out of this device
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
