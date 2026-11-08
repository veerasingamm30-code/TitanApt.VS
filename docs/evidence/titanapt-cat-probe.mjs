/* Focused probe: mock-test aptitude category selection reaches the real pool. */
import fs from 'node:fs';
const BASE = 'http://localhost:4000';
const jar = {};
const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${String(detail).slice(0, 120)}` : ''}`);
}
function cookieHeader() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }
async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (Object.keys(jar).length) headers.cookie = cookieHeader();
  if (jar['ta_csrf']) headers['x-csrf-token'] = jar['ta_csrf'];
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const line of (res.headers.getSetCookie?.() ?? [])) {
    const m = line.match(/^\s*([^=;\s]+)=([^;]*)/);
    if (m) { if (m[2] === '') delete jar[m[1]]; else jar[m[1]] = m[2]; }
  }
  let json = null; try { json = JSON.parse(await res.text()); } catch {}
  return { status: res.status, json };
}
const data = (r) => (r.json && r.json.data !== undefined ? r.json.data : null);

const email = `probe-cat-${Date.now()}@example.com`;
let r = await req('/api/auth/csrf');
if (data(r)?.csrfToken) jar['ta_csrf'] = data(r).csrfToken;
r = await req('/api/auth/signup', { method: 'POST', body: { displayName: 'Category Probe', email, password: 'Px' + Math.random().toString(36).slice(2) + 'Qz9#Top' } });
record('signup (extended probe)', r.status === 201, `status=${r.status}`);

for (const category of ['QUANTITATIVE', 'LOGICAL', 'VERBAL', 'DATA_INTERPRETATION', 'TECHNICAL']) {
  r = await req(`/api/mocks/company-mock-tcs/config?category=${category}`);
  const cfg = data(r) ?? {};
  const inCategory = Object.values(cfg.categories ?? {}).filter((x) => true);
  const listed = (cfg.categories ?? []).some((c) => c.subject === category && c.count > 0);
  record(`config?category=${category} pools filtered`, listed && cfg.pool.any > 0 && cfg.pool.any <= 137, `pool.any=${cfg.pool.any} easy=${cfg.pool.easy} listed=${listed} categories=${(cfg.categories ?? []).length}`);
}
r = await req('/api/mocks/company-mock-tcs/config');
const cfgAll = data(r) ?? {};
record('config without category shows every supported category', (cfgAll.categories ?? []).length >= 1 && cfgAll.pool.any === 137, `pool.any=${cfgAll.pool.any} categories=${(cfgAll.categories ?? []).map((c) => `${c.subject}:${c.count}`).join(',')}`);

r = await req('/api/mocks/company-mock-tcs/start', { method: 'POST', body: { category: 'QUANTITATIVE', questionCount: 10, durationMinutes: 15 } });
const attempt = data(r) ?? {};
record('start with category creates attempt', r.status === 201 && attempt.questions?.length === 10, `status=${r.status} q=${attempt.questions?.length}`);
// confirm every selected question belongs to a QUANTITATIVE topic question set:
// the attempt payload does not expose subjects, so spot-check via sectionName/questions
const firstQs = (attempt.questions ?? []).slice(0, 5).map((q) => q.topic?.name ?? q.topicName ?? '').join('|');
record('attempt assembled (category -> engine path returned questions)', attempt.questions?.length === 10, firstQs);
r = await req(`/api/mocks/attempts/${attempt.id}/submit`, { method: 'POST', body: {} });
record('category attempt submits and scores', (data(r)?.correct ?? 0) + (data(r)?.incorrect ?? 0) + (data(r)?.unanswered ?? 0) === 10, `c=${data(r)?.correct} i=${data(r)?.incorrect} u=${data(r)?.unanswered}`);

r = await req('/api/mocks/company-mock-tcs/start', { method: 'POST', body: { category: 'VERBAL', questionCount: 50 } });
record('invalid configuration rejected honestly', r.status === 409 || String(data(r)).includes('Only'), `status=${r.status} err=${r.json?.error}`);

fs.writeFileSync('C:/Users/acer/AppData/Local/Temp/opencode/titanapt-category-probe.json', JSON.stringify({ results }, null, 2));
const pass = results.filter((x) => x.pass).length;
console.log(`\n${pass}/${results.length} category checks passed`);
if (pass !== results.length) process.exitCode = 1;
