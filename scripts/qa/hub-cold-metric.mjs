/* Measure cold-start latency of GET /api/learning/volumes right after the API boots. */
import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS = 'C:/Users/acer/AppData/Local/Temp/opencode/titanapt-probe-creds.json';
const BASE = 'http://localhost:4000';
const jar = {};

async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (Object.keys(jar).length) headers.cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (jar['ta_csrf']) headers['x-csrf-token'] = jar['ta_csrf'];
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const line of (res.headers.getSetCookie?.() ?? [])) {
    const m = line.match(/^\s*([^=;\s]+)=([^;]*)/);
    if (m) { if (m[2] === '') delete jar[m[1]]; else jar[m[1]] = m[2]; }
  }
  let json = null; try { json = JSON.parse(await res.text()); } catch {}
  return { status: res.status, json };
}

let creds = null;
try { creds = JSON.parse(fs.readFileSync(CREDS, 'utf8')); } catch { /* temp dir may be swept */ }
if (!creds) {
  // signup a fresh throwaway QA account (rate limiter is fresh after API restart)
  creds = { displayName: 'Cold Metric', email: `probe-cold-${Date.now()}@example.com`, password: 'Px' + crypto.randomBytes(8).toString('hex') + '#Top8!' };
}
let r = await req('/api/auth/csrf');
if (r.json?.data?.csrfToken) jar['ta_csrf'] = r.json.data.csrfToken;
r = await req('/api/auth/signup', { method: 'POST', body: creds });
if (r.status === 429 || r.status === 409) {
  // limiter tripped, or the shared probe account already exists -> login
  r = await req('/api/auth/login', { method: 'POST', body: { email: creds.email, password: creds.password } });
}
if (r.status !== 201 && r.status !== 200) { console.log('auth failed', r.status, JSON.stringify(r.json).slice(0, 200)); process.exit(2); }
if (r.json?.data) {} // noop
// refresh csrf token issued at login
let csrf = jar['ta_csrf'];

const t0 = Date.now();
r = await req('/api/learning/volumes');
const dt = (Date.now() - t0) / 1000;
const volumes = r.json?.data ?? [];
const worst = volumes.map((v) => `${v.slug}:chapters=${v.chapters.length};w=${(v.warnings ?? []).length}`).join(' ');
console.log(`cold GET /api/learning/volumes -> status=${r.status} in ${dt.toFixed(1)}s volumes=${volumes.length} \n${worst}`);
