/* Cycle J probe: Settings profile/avatar flow, dashboard goal + streak,
 * practice pool honesty, topics difficulty breakdown.
 * Runs against http://localhost:4000 with a throwaway/persisted probe account. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TA_BASE_URL ?? 'http://localhost:4000';
const CREDS_FILE = 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt-probe-creds.json';

const jar = {};
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${String(detail).slice(0, 200)}` : ''}`);
}
function cookieHeader() {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}
async function req(path, { method = 'GET', body, rawBody, isJson = true } = {}) {
  const headers = {};
  if (Object.keys(jar).length) headers.cookie = cookieHeader();
  const csrf = jar['ta_csrf'];
  if (csrf) headers['x-csrf-token'] = csrf;
  headers['titanapt-origin'] = 'http://localhost:5173';
  if (rawBody !== undefined) {
    headers['content-type'] = 'application/octet-stream';
    headers['x-avatar-type'] = 'image/png';
  } else if (isJson) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of setCookies) {
    const m = line.match(/^\s*([^=;\s]+)=([^;]*)/);
    if (m) { if (m[2] === '') delete jar[m[1]]; else jar[m[1]] = m[2]; }
  }
  let json = null;
  const text = await res.text();
  if (isJson) { try { json = JSON.parse(text); } catch { json = null; } }
  return { status: res.status, json, ok: res.ok, text };
}
const data = (r) => (r.json && r.json.data !== undefined ? r.json.data : null);

// 1x1 PNG (valid magic bytes + IEND)
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f030005fe02fea72d7f640000000049454e44ae426082',
  'hex',
);

async function main() {
  let creds = null;
  try { creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { /* first run */ }
  if (!creds || !creds.email || !creds.password) {
    creds = {
      displayName: 'Cycle J Probe',
      email: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: 'Px' + Math.random().toString(36).slice(2) + 'Qz9#Top',
    };
  }

  // bootstrap
  let r = await req('/api/auth/csrf');
  if (data(r)?.csrfToken) jar['ta_csrf'] = data(r).csrfToken;
  record('csrf bootstrap', Boolean(jar['ta_csrf']), `status=${r.status}`);

  // login or signup
  r = await req('/api/auth/login', { method: 'POST', body: { email: creds.email, password: creds.password } });
  if (r.status !== 200) {
    r = await req('/api/auth/signup', { method: 'POST', body: creds });
  }
  const authed = (r.status === 200 || r.status === 201) && Boolean(jar['ta_session']);
  record('login/signup + session', authed, `status=${r.status}`);
  if (!authed) { process.exitCode = 2; return; }
  try { fs.writeFileSync(CREDS_FILE, JSON.stringify(creds)); } catch { /* best effort */ }

  // --- Settings flow: profile GET (auth/me), PATCH, avatar upload, avatar fetch, avatar delete+re-upload
  r = await req('/api/auth/me');
  record('GET /api/auth/me', r.status === 200 && data(r)?.user, `status=${r.status}`);

  const patchBody = {
    displayName: 'Cycle J Probe',
    timezone: 'Asia/Kolkata',
    dailyGoal: 10,
    theme: 'dark',
    accent: 'orange',
    studyTargetMinutes: 47,
  };
  r = await req('/api/auth/profile', { method: 'PATCH', body: patchBody });
  record('PATCH /api/auth/profile', r.status === 200 && data(r)?.user?.displayName === 'Cycle J Probe', `status=${r.status} displayName=${data(r)?.user?.displayName}`);
  // studyTargetMinutes persists on the profile and is served via /api/dashboard
  r = await req('/api/dashboard');
  record('PATCH /api/auth/profile persists study target', r.status === 200 && data(r)?.user?.studyTargetMinutes === 47, `status=${r.status} target=${data(r)?.user?.studyTargetMinutes}`);

  r = await req('/api/auth/avatar', { method: 'POST', rawBody: PNG });
  record('POST /api/auth/avatar (PNG upload)', r.status === 201 && data(r)?.user?.avatarUrl, `status=${r.status} avatarUrl=${data(r)?.user?.avatarUrl}`);

  r = await req('/api/auth/avatar');
  record('GET /api/auth/avatar serves image', r.status === 200 && !r.json, `status=${r.status} bytes=${r.text.length}`);

  r = await req('/api/auth/avatar', { method: 'POST', rawBody: Buffer.from('not an image') });
  record('POST /api/auth/avatar rejects non-image', r.status === 400 && /image/i.test(r.json?.error?.message ?? ''), `status=${r.status} msg=${r.json?.error?.message}`);

  r = await req('/api/auth/avatar', { method: 'DELETE' });
  record('DELETE /api/auth/avatar', r.status === 200, `status=${r.status}`);

  // --- Dashboard: goal counts an answered question; streak fields; streakHistory
  const before = await req('/api/dashboard');
  const beforeGoal = data(before)?.dailyGoal?.completed ?? -1;
  const beforeActivity = data(before)?.streak?.todayActivityCount ?? -1;
  record('GET /api/dashboard', before.status === 200, `status=${before.status}`);

  // practice a question
  const pool = await req('/api/practice/sessions', { method: 'POST', body: { count: 1 } });
  record('POST /api/practice/sessions (mixed, 1q)', pool.status === 201, `status=${pool.status} msg=${pool.json?.error?.message}`);
  if (pool.status === 201) {
    const q = data(pool)?.questions?.[0];
    const opt = q?.options?.[0];
    const ans = await req(`/api/practice/sessions/${data(pool).id}/questions/${q.id}/answer`, {
      method: 'POST',
      body: { optionId: opt.id, durationMs: 1000, idempotencyKey: `probe-${Date.now()}-answer1` },
    });
    record('answer a practice question', ans.status === 201, `status=${ans.status}`);
    const after = await req('/api/dashboard');
    const afterGoal = data(after)?.dailyGoal?.completed;
    const afterActivity = data(after)?.streak?.todayActivityCount;
    record('dashboard dailyGoal counts the answer', afterGoal === beforeGoal + 1, `before=${beforeGoal} after=${afterGoal}`);
    record('dashboard streak.todayActivityCount counts the answer', afterActivity === beforeActivity + 1, `before=${beforeActivity} after=${afterActivity}`);
    record('dashboard streakHistory present', Array.isArray(data(after)?.streakHistory) && data(after).streakHistory.length >= 14, `len=${data(after)?.streakHistory?.length}`);
  }

  // --- Practice pool honesty: Hard + time-and-work currently 409; topic payload carries difficultyCounts?
  const topics = await req('/api/topics');
  const taw = (data(topics) ?? []).find((t) => t.slug === 'time-and-work');
  record('GET /api/topics', topics.status === 200, `status=${topics.status} count=${(data(topics) ?? []).length}`);
  record('topic payload includes difficultyCounts', taw && typeof taw.difficultyCounts === 'object', `counts=${JSON.stringify(taw?.difficultyCounts)}`);

  const hard = await req('/api/practice/sessions', { method: 'POST', body: { count: 5, topicSlug: 'time-and-work', difficulty: 'HARD' } });
  record('Hard+time-and-work rejects with clear 409', hard.status === 409, `status=${hard.status} msg=${hard.json?.error?.message}`);

  const medium = await req('/api/practice/sessions', { method: 'POST', body: { count: 3, topicSlug: 'time-and-work', difficulty: 'MEDIUM' } });
  record('Medium+time-and-work builds a set', medium.status === 201, `status=${medium.status} pool=${data(medium)?.selection?.pool}`);

  process.exitCode = results.every((x) => x.pass) ? 0 : 1;
  fs.writeFileSync(path.join(here, 'cycle-j-probe.json'), JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
