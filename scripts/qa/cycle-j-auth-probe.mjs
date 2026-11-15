/* Fresh auth matrix evidence: wrong password, empty input, duplicate signup,
 * protected route, logout invalidation. Uses the persisted probe account. */
import fs from 'node:fs';

const BASE = 'http://localhost:4000';
const CREDS_FILE = 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt-probe-creds.json';
const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
const jar = {};
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${String(detail).slice(0, 140)}` : ''}`);
}
function cookieHeader() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }
async function req(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (Object.keys(jar).length) headers.cookie = cookieHeader();
  if (jar['ta_csrf']) headers['x-csrf-token'] = jar['ta_csrf'];
  if (body !== undefined) headers['content-type'] = 'application/json';
  headers['titanapt-origin'] = 'http://localhost:5173';
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of setCookies) {
    const m = line.match(/^\s*([^=;\s]+)=([^;]*)/);
    if (m) { if (m[2] === '') delete jar[m[1]]; else jar[m[1]] = m[2]; }
  }
  let json = null; const text = await res.text();
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? null;

let r = await req('/api/auth/csrf');
if (data(r)?.csrfToken) jar['ta_csrf'] = data(r).csrfToken;

r = await req('/api/auth/login', { method: 'POST', body: { email: creds.email, password: 'WrongPassword1!' } });
record('wrong password rejected 401', r.status === 401, `status=${r.status} msg=${r.json?.error?.message}`);

r = await req('/api/auth/login', { method: 'POST', body: { email: '', password: '' } });
record('empty login rejected 400', r.status === 400, `status=${r.status} code=${r.json?.error?.code}`);

r = await req('/api/auth/login', { method: 'POST', body: { email: 'not-an-email', password: 'x' } });
record('invalid email rejected 400', r.status === 400, `status=${r.status} code=${r.json?.error?.code}`);

r = await req('/api/auth/signup', { method: 'POST', body: { ...creds, displayName: 'Dup' } });
record('duplicate signup rejected 409', r.status === 409, `status=${r.status} msg=${r.json?.error?.message}`);

r = await req('/api/dashboard');
record('protected route 401 without session', r.status === 401, `status=${r.status}`);

r = await req('/api/auth/login', { method: 'POST', body: { email: creds.email, password: creds.password } });
record('valid login 200 + session cookie', r.status === 200 && Boolean(jar['ta_session']), `status=${r.status}`);

r = await req('/api/auth/me');
record('session works (auth/me)', r.status === 200 && data(r)?.user?.email === creds.email, `status=${r.status}`);

r = await req('/api/auth/logout', { method: 'POST' });
record('logout 200', r.status === 200, `status=${r.status}`);

r = await req('/api/auth/me');
record('session invalidated after logout', r.status === 401, `status=${r.status}`);

process.exitCode = results.every((x) => x.pass) ? 0 : 1;
