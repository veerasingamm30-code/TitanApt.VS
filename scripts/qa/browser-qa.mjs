/* TitanApt browser QA probe (phase-2 bug hunt).
 * Walks the real UI in Edge (chromium channel) collecting console errors,
 * page errors and failed network requests, and asserts core flows.
 *
 * NOTE: playwright is provided by a globally cached install (../_npx cache)
 * and is NOT a project dependency. Run with:
 *   node --experimental-? none; plain `node scripts/qa/browser-qa.mjs`
 * (the require path below must point at the cached playwright copy).
 * Evidence (screenshots + result JSON) is written to docs/evidence/browser/. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/acer/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const pw = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..', '..');
const BASE = process.env.TA_WEB_URL ?? 'http://localhost:5173';
const OUT_DIR = path.join(project, 'docs', 'evidence', 'browser');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, 'browser-qa-results.json');

const consoleErrors = [];
const pageErrors = [];
const badRequests = [];
const periodic = []; // suspected retry/long-poll loops
const checks = [];
const events = [];
const note = (m) => { events.push(m); console.log('NOTE — ' + m); };
const record = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${String(detail).slice(0, 150)}` : ''}`);
};

const email = `probe-ui-${Date.now()}@example.com`;
const password = 'Px' + Math.random().toString(36).slice(2) + 'Qz9#Top8!';

const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const url = msg.location()?.url ?? '';
    if (url.includes('/api/auth/me') && msg.text().includes('401')) return; // pre-auth gate noise
    consoleErrors.push({ text: msg.text(), url });
  }
});
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('response', (res) => {
  const st = res.status();
  if (st >= 400 && st !== 401 && !res.url().includes('favicon')) badRequests.push({ url: res.url(), status: st });
});
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/api/learning/volumes') || u.includes('/api/dashboard')) periodic.push({ u: u.split('?')[0], t: Date.now() });
});
page.on('requestfailed', (req) => {
  const f = req.failure()?.errorText ?? '';
  if (!/ERR_ABORTED/i.test(f)) badRequests.push({ url: req.url(), status: 'FAILED:' + f });
});
async function shot(name) { await page.screenshot({ path: path.join(OUT_DIR, name) }); }

// ---------- 1. Landing ----------
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const marqueeImgs = await page.locator('.lq-track img').count();
record('landing: marquee has 52 logo cards (26 x doubled track)', marqueeImgs === 52, `imgs=${marqueeImgs}`);
const unloadedAtSettle = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.lq-track img')).filter((i) => !i.complete || i.naturalWidth === 0).length);
record('landing: all marquee logos loaded at first pass', unloadedAtSettle === 0, `unloaded=${unloadedAtSettle}`);
const firstCard = page.locator('.lq-track-half > *').first();
let panelVisible = false;
try {
  await firstCard.click({ force: true });
  panelVisible = await page.locator('[role="dialog"], .lq-panel').first().isVisible().catch(() => false);
} catch (e) { note('card click failed: ' + String(e).slice(0, 150)); }
record('landing: company card click opens info panel', panelVisible);
await page.keyboard.press('Escape');
await shot('01-landing.png');

// ---------- 2. Signup via real UI ----------
await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded' });
await page.locator('input[placeholder="How should we address you?"]').fill('UI Probe');
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[placeholder="At least 10 characters"]').fill(password);
await page.locator('button:has-text("Create account")').click();
try {
  await page.waitForURL(/\/app/, { timeout: 15000 });
  record('signup: form submits and reaches the app', true, page.url());
} catch {
  const errText = await page.locator('.form-error, [role="alert"]').first().textContent().catch(() => null);
  record('signup: form submits and reaches the app', false, `still on ${page.url()} alert=${errText}`);
  await shot('02-signup-stuck.png');
}

// ---------- 3. Dashboard (index route) ----------
let streakSeen = false, orbitSeen = false;
try {
  await page.waitForSelector('.streak-chart', { timeout: 12000 });
  streakSeen = true;
} catch {}
try {
  await page.waitForSelector('.company-orbit-section', { timeout: 8000 });
  orbitSeen = true;
} catch {}
const dashText = await page.evaluate(() => document.body.innerText);
record('dashboard: streak chart renders on /app', streakSeen, dashText.slice(0, 120).replace(/\n/g, ' | '));
record('dashboard: company orbit section renders on /app', orbitSeen);
await shot('03-dashboard.png');

// search interaction
const search = page.locator('[aria-label="Search TitanApt"]');
record('dashboard: search bar present', await search.count() > 0);
if (await search.count() > 0) {
  await search.fill('number');
  try {
    await page.waitForSelector('#search-results [role="option"]', { timeout: 4000 });
    const optionCount = await page.locator('#search-results [role="option"]').count();
    record('search: grouped results appear for "number"', optionCount > 0, `options=${optionCount}`);
  } catch {
    record('search: grouped results appear for "number"', false, 'no #search-results options appeared');
  }
  await shot('04-search.png');
  await page.keyboard.press('Escape');
}

// theme toggle
const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.locator('button.theme-toggle').first().click();
await page.waitForTimeout(400);
const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
record('theme: toggle flips data-theme', themeBefore !== themeAfter && themeAfter !== null, `${themeBefore} -> ${themeAfter}`);
await page.locator('button.theme-toggle').first().click();
await page.waitForTimeout(300);

// ---------- 4. Practice ----------
await page.goto(BASE + '/app/practice', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await shot('05-practice.png');
const startBtn = page.locator('.practice-form-panel button:has-text("Start"), button:has-text("Begin practice"), button:has-text("Start")').first();
if (await startBtn.count() > 0) {
  await startBtn.click();
  let sessionOk = false;
  try { await page.waitForURL(/practice\//, { timeout: 10000 }); sessionOk = true; } catch {}
  if (!sessionOk) { await page.waitForSelector('.question-card', { timeout: 8000 }).then(() => { sessionOk = true; }).catch(() => {}); }
  record('practice: session starts', sessionOk, page.url());
  if (sessionOk) {
    await shot('06-practice-session.png');
    const opt = page.locator('.option-button').first();
    if (await opt.count() > 0) {
      await opt.click();
      let feedback = false;
      try { await page.waitForSelector('.feedback-panel', { timeout: 6000 }); feedback = true; } catch {}
      record('practice: answering shows server feedback panel', feedback);
      await shot('07-practice-feedback.png');
    } else {
      record('practice: answering shows server feedback panel', false, 'no .option-button found');
    }
  }
} else {
  record('practice: session starts', false, 'no start button found');
}

// ---------- 5. Mock detail ----------
await page.goto(BASE + '/app/mocks/company-mock-tcs', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await shot('08-mock-detail.png');
const mockText = await page.evaluate(() => document.body.innerText);
record('mock: detail page loads config UI', /Test configuration|Aptitude category|Difficulty/i.test(mockText));

// ---------- 6. Lessons + sibling nav ----------
await page.goto(BASE + '/app/learn/boolean-algebra', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const lessonLinks = await page.locator('a[href*="/lessons/"]').count();
record('lessons: boolean-algebra lists lesson links', lessonLinks >= 3, `links=${lessonLinks}`);
if (lessonLinks > 0) {
  await page.locator('a[href*="/lessons/"]').first().click();
  await page.waitForURL(/lessons\//, { timeout: 8000 });
  await page.waitForTimeout(1200);
  const navCount = await page.locator('.lesson-sibling-nav a, .lesson-sibling-nav button').count();
  record('lesson: sibling nav present', navCount > 0, `items=${navCount}`);
  await shot('09-lesson.png');
  if (navCount > 0) {
    const before = page.url();
    const next = page.locator('.lesson-sibling-nav a').last();
    await next.click();
    await page.waitForTimeout(1500);
    record('lesson: sibling nav navigates', page.url() !== before, `${before} -> ${page.url()}`);
  }
}

// ---------- 7. Learning hub (watch for endless network activity) ----------
let hubOk = false;
try {
  await page.goto(BASE + '/app/learning', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.learn-overview', { timeout: 20000 });
  hubOk = true;
} catch (e) {
  note('hub wait failure: ' + String(e).slice(0, 160));
}
const hubText = await page.evaluate(() => document.body.innerText);
record('learning: hub renders (volumes + progress)', hubOk && !/Something went wrong/i.test(hubText), hubText.slice(0, 100).replace(/\n/g, ' | '));
await shot('10-learning.png');
// detect periodic refetch storm: inspect captured /api/dashboard + /api/learning/volumes requests
const counts = {};
for (const p of periodic) counts[p.u] = (counts[p.u] ?? 0) + 1;
const storm = Object.entries(counts).filter(([, n]) => n > 6);
record('network: no endless refetch loop detected', storm.length === 0, JSON.stringify(storm));

// ---------- 8. Sidebar navigation ----------
await page.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
const navPairs = [['Dashboard', '/app'], ['Topic lessons', '/app/learn'], ['Learning Hub', '/app/learning'], ['Practice', '/app/practice'], ['Crack Time', '/app/crack-time'], ['Mock tests', '/app/mocks']];
for (const [label, href] of navPairs) {
  const link = page.locator(`aside a[href="${href}"]`).first();
  if (await link.count() === 0) { record(`nav: sidebar link "${label}"`, false, 'link not found'); continue; }
  await link.click();
  await page.waitForTimeout(600);
  const ok = page.url().endsWith(href);
  const bodyText = await page.evaluate(() => document.body.innerText);
  record(`nav: "${label}" route renders`, ok && !/404|not found/i.test(bodyText.slice(0, 200)), page.url());
  await page.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

// ---------- 9. responsive ----------
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
record('responsive: no horizontal scroll at 390px', !hscroll);
await shot('11-mobile.png');

// ---------- write & summarize ----------
const passCount = checks.filter((c) => c.pass).length;
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, email, checks, consoleErrors, pageErrors, badRequests, events }, null, 2));
console.log(`\n${passCount}/${checks.length} UI checks passed`);
console.log(`console errors: ${consoleErrors.length} | page errors: ${pageErrors.length} | bad responses: ${badRequests.length}`);
console.log('Results: ' + OUT);
await browser.close();
if (passCount !== checks.length) process.exitCode = 1;
