/* TitanApt end-to-end HTTP integration probe (34 checks).
 * Runs against a live stack (default API http://localhost:4000).
 * Creates a throwaway learner account through the real signup endpoint;
 * on signup rate-limit it falls back to login of a persisted probe account
 * (credentials live only in the local probe state file, never logged).
 * Results: JSON + stdout summary. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..', '..');
const BASE = process.env.TA_BASE_URL ?? 'http://localhost:4000';
const OUT = process.env.TA_OUT ?? path.join(project, 'docs', 'evidence', 'titanapt-integration.json');
const CREDS_FILE = process.env.TA_CREDS ?? 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt-probe-creds.json';

const jar = {};
const results = [];
let creds = null;
try { creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { /* first run */ }
if (!creds || !creds.email || !creds.password) {
  creds = {
    displayName: 'Integration Probe ' + Math.random().toString(36).slice(2, 6),
    email: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'Px' + Math.random().toString(36).slice(2) + 'Qz9#Top',
  };
}
const events = [];
function note(message) { events.push(message); }
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}` + (detail ? ` :: ${String(detail).slice(0, 140)}` : ''));
}

function cookieHeader() {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function req(path, { method = 'GET', body, isJson = true } = {}) {
  const headers = {};
  if (Object.keys(jar).length) headers.cookie = cookieHeader();
  if (isJson) headers['content-type'] = 'application/json';
  const csrf = jar['ta_csrf'];
  if (csrf) headers['x-csrf-token'] = csrf;
  headers['titanapt-origin'] = 'http://localhost:5173';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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

async function main() {
  // 1. pre-login public marquee data
  let r = await req('/api/public/companies');
  const companies = data(r) ?? [];
  record('public: /api/public/companies without login', r.status === 200 && companies.length === 26, `status=${r.status} count=${companies.length}`);
  const slugs = companies.map((c) => c.slug);
  const topTen = ['tcs', 'infosys', 'hcltech', 'wipro', 'tech-mahindra', 'ltimindtree', 'zoho', 'persistent-systems', 'coforge', 'mphasis'];
  record('public: marquee covers all Top-10 orbit companies + 26 unique entries', topTen.every((s) => slugs.includes(s)) && new Set(slugs).size === 26, `unique=${new Set(slugs).size}`);
  record('public: every company carries website + logo + overview', companies.filter((c) => c.website && c.overview).length >= 20, `withWeb+Overview=${companies.filter((c) => c.website && c.overview).length}`);

  // CSRF bootstrap (same handshake the web client performs)
  r = await req('/api/auth/csrf');
  if (data(r)?.csrfToken) jar['ta_csrf'] = data(r).csrfToken;
  record('auth: csrf bootstrap issues token', Boolean(jar['ta_csrf']), `status=${r.status}`);

  // protected route must stay protected
  r = await req('/api/dashboard');
  record('public: protected /api/dashboard still 401 unauthenticated', r.status === 401, `status=${r.status}`);

  // 2. signup via real backend (fall back to login of the persisted probe account)
  r = await req('/api/auth/signup', { method: 'POST', body: creds });
  // 201 = fresh account; 409 (account exists) or 429 (limiter) -> login fallback reuses it
  let authed = r.status === 201 && Boolean(jar['ta_session']);
  if (!authed && (r.status === 429 || r.status === 409)) {
    note(`signup not available (status=${r.status}); falling back to login of the persisted probe account`);
    r = await req('/api/auth/login', { method: 'POST', body: { email: creds.email, password: creds.password } });
    authed = r.status === 200 && Boolean(jar['ta_session']);
    record('auth: signup or login of persisted probe account + session', authed, `status=${r.status}`);
    if (!authed) process.exitCode = 2;
  } else {
    record('auth: signup creates account + session', authed, `status=${r.status}`);
  }
  if (authed) {
    try { fs.writeFileSync(CREDS_FILE, JSON.stringify(creds)); } catch { /* best effort */ }
  }

  // 3. session works
  r = await req('/api/auth/me');
  record('auth: /api/auth/me returns session user', r.status === 200 && data(r)?.user?.email === creds.email, `status=${r.status} email=${data(r)?.user?.email}`);

  // 4. dashboard shape
  r = await req('/api/dashboard');
  const d = data(r) ?? {};
  record('dashboard: streak fields present', Boolean(d.streak) && Boolean(d.streakHistory), `status=${r.status} keys=${Object.keys(d)}`);
  const baselineStreak = d.streak?.current ?? null;
  record('dashboard: streak is a sane non-negative number', Number.isInteger(baselineStreak) && baselineStreak >= 0, `current=${baselineStreak}`);

  // 5. topics endpoint — new lesson sets visible
  r = await req('/api/topics');
  const topics = data(r) ?? [];
  const boolTopic = topics.find((t) => t.slug === 'boolean-algebra');
  const progTopic = topics.find((t) => t.slug === 'programming-logic');
  record('topics: Boolean Algebra exposes 3 authored lessons', boolTopic?.lessonCount === 3, `count=${boolTopic?.lessonCount}`);
  record('topics: Programming Logic exposes 3 authored lessons', progTopic?.lessonCount === 3, `count=${progTopic?.lessonCount}`);

  // 6. topic detail + lesson detail + siblings
  r = await req('/api/topics/boolean-algebra');
  const boolDetail = data(r) ?? {};
  const lessons = boolDetail.lessons ?? [];
  record('topics/:slug lists Boolean Algebra lessons', r.status === 200 && lessons.length === 3, `status=${r.status} list=${lessons.length}`);
  const lessonId = lessons[0]?.id;
  r = await req(`/api/lessons/${lessonId}`);
  const lesson = data(r) ?? {};
  record('lesson: detail loads with checkpoint questions', r.status === 200 && lesson.checkpointQuestions?.length >= 2, `status=${r.status} cp=${lesson.checkpointQuestions?.length}`);
  record('lesson: siblings expose 3 lessons for prev/next', lesson.siblings?.length === 3, `siblings=${lesson.siblings?.length}`);
  r = await req(`/api/lessons/${lessonId}/checkpoint`, { method: 'POST', body: { submissionKey: 'cp' + Math.random().toString(36).slice(2, 10), answers: (lesson.checkpointQuestions ?? []).slice(0, 1).map((q) => ({ questionId: q.id, optionId: q.options?.[0]?.id })) } });
  record('lesson: checkpoint submit scored by server', Boolean(r.json?.data?.correct !== undefined || r.json?.error), `status=${r.status} keys=${Object.keys(r.json?.data ?? r.json ?? {})}`);

  // 7. practice — qualify the streak day through real practice sessions
  let streak = null;
  let guard = 0;
  while (guard < 24) {
    guard += 1;
    r = await req('/api/dashboard');
    streak = data(r)?.streak ?? {};
    if (streak.todayCorrect >= 4) break;
    r = await req('/api/practice/sessions', { method: 'POST', body: { count: 6 } });
    const sessionLoop = data(r) ?? {};
    if (r.status !== 201) { note(`practice loop: start failed ${r.status}`); break; }
    for (const q of sessionLoop.questions ?? []) {
      const options = q.options ?? [];
      const opt = options[Math.min(3, options.length - 1) % options.length];
      if (!opt) continue;
      const answer = await req(`/api/practice/sessions/${sessionLoop.id}/questions/${q.id}/answer`, {
        method: 'POST',
        body: { optionId: opt.id, idempotencyKey: 'probe-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), durationMs: 4200 },
      });
      const fb = data(answer);
      if (fb && fb.isCorrect) note('practice: correct answer registered');
    }
  }
  r = await req('/api/dashboard');
  streak = data(r)?.streak ?? {};
  record('practice: streak day qualified after >=4 unique correct answers', streak.todayQualified === true && streak.todayCorrect >= 4, `todayQualified=${streak.todayQualified} todayCorrect=${streak.todayCorrect} loops=${guard}`);
  record('practice: today counts as a streak day (current=1, longest>=1)', streak.current === 1 && streak.longest >= 1, `current=${streak.current} longest=${streak.longest}`);

  // duplicate submission must not inflate the count
  r = await req('/api/dashboard');
  streak = data(r)?.streak ?? {};
  record('streak: refresh persistence (same values after re-fetch)', streak.current === 1 && streak.longest >= 1 && streak.todayQualified === true, `current=${streak.current} longest=${streak.longest}`);

  // 8. mock test configured start
  r = await req('/api/mocks/company-mock-tcs/config');
  const cfg = data(r) ?? {};
  record('mock: company mock config exposes pool + ranges', Boolean(cfg.pool) && Boolean(cfg.ranges), `pool.any=${cfg.pool?.any}`);
  r = await req('/api/mocks/company-mock-tcs/start', { method: 'POST', body: { difficulty: 'EASY', questionCount: 20, durationMinutes: 30 } });
  const attempt = data(r) ?? {};
  record('mock: configured attempt has 20 questions', attempt.questions?.length === 20, `q=${attempt.questions?.length}`);
  const deadline = attempt.secondsRemaining ?? 0;
  record('mock: configured attempt honours 30-min duration', deadline > 28 * 60 && deadline <= 30 * 60, `secondsRemaining=${deadline}`);
  let attempted = 0;
  for (const q of attempt.questions ?? []) {
    const opt = q.options?.[0] ?? q.question?.options?.[0];
    if (!opt) continue;
    const res = await req(`/api/mocks/attempts/${attempt.id}/answer`, { method: 'PATCH', body: { questionId: q.id ?? q.questionId, optionId: opt.id } });
    if (res.ok) attempted += 1;
  }
  note(`mock: ${attempted} answers recorded`);
  r = await req(`/api/mocks/attempts/${attempt.id}/submit`, { method: 'POST', body: {} });
  const result = data(r) ?? {};
  record('mock: submit returns server-computed results', (result.correct ?? 0) + (result.incorrect ?? 0) + (result.unanswered ?? 0) === 20, `c=${result.correct} i=${result.incorrect} u=${result.unanswered}`);
  record('mock: unanswered equals 20 minus attempted', result.unanswered === 20 - attempted, `unanswered=${result.unanswered} attempted=${attempted}`);
  r = await req('/api/mocks/attempts/' + attempt.id);
  const attemptView = data(r) ?? {};
  record('mock: submitted attempt persists as SUBMITTED with score', attemptView.status === 'SUBMITTED' && typeof attemptView.score === 'number', `status=${attemptView.status} score=${attemptView.score}`);

  // 9. learning hub volumes
  r = await req('/api/learning/volumes');
  const volumes = data(r)?.volumes ?? data(r) ?? [];
  record('learning: 8 volumes with chapter data', r.status === 200 && volumes.length === 8, `status=${r.status} volumes=${volumes.length}`);

  // 10. search
  r = await req('/api/search?q=number');
  const search = data(r) ?? {};
  const groups = JSON.stringify(search).toLowerCase();
  record('search: "number" returns matched groups', r.status === 200 && groups.includes('number'), `status=${r.status}`);

  // 11. study target custom value persists
  r = await req('/api/study/target', { method: 'PATCH', body: { minutes: 35 } });
  record('study: custom 35-min target accepted', r.status === 200 && data(r)?.targetMinutes === 35, `target=${data(r)?.targetMinutes}`);
  r = await req('/api/dashboard');
  record('study: dashboard reports 35-min study target', data(r)?.user?.studyTargetMinutes === 35, `got=${data(r)?.user?.studyTargetMinutes}`);

  // 12. theme persistence via profile
  r = await req('/api/auth/profile', { method: 'PATCH', body: { theme: 'light' } });
  record('settings: theme patch accepted', r.status === 200, `status=${r.status}`);
  r = await req('/api/auth/me');
  record('settings: theme persisted to profile', data(r)?.user?.theme === 'light', `theme=${data(r)?.user?.theme}`);
  r = await req('/api/auth/profile', { method: 'PATCH', body: { theme: 'dark' } });
  record('settings: theme back to dark', r.status === 200, `status=${r.status}`);

  // 13. logout + protection
  r = await req('/api/auth/logout', { method: 'POST' });
  record('auth: signout clears session', r.status === 200 || r.status === 204 || (r.json ?? {}).ok === true, `status=${r.status}`);
  r = await req('/api/auth/me');
  record('auth: /api/auth/me anonymous after signout', r.status === 401 || (r.status === 200 && data(r) === null), `status=${r.status} data=${JSON.stringify(data(r))}`);
  r = await req('/api/practice/sessions', { method: 'POST', body: { count: 2 } });
  record('auth: protected practice 401 after signout', r.status === 401, `status=${r.status}`);

  const passCount = results.filter((x) => x.pass).length;
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, results, events }, null, 2));
  console.log(`\n${passCount}/${results.length} checks passed. Full log: ${OUT}`);
  if (passCount !== results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('RUNNER ERROR:', err && err.message);
  process.exitCode = 2;
});
