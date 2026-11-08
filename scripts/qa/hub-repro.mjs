/* Focused repro: authenticated Learning Hub slow/never renders?
 * Captures whether the page stuck on loader, error state, or rendered. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/acer/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const pw = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..', '..');
const SHOT = path.join(project, 'docs', 'evidence', 'browser');
fs.mkdirSync(SHOT, { recursive: true });

const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext()).newPage();
const apiLog = [];
page.on('response', (r) => { if (r.url().includes('/api/')) apiLog.push({ t: Date.now(), url: r.url().replace('http://localhost:5173', ''), status: r.status() }); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') apiLog.push({ console: m.type(), text: m.text().slice(0, 200) }); });

// signup through UI
await page.goto('http://localhost:5173/signup', { waitUntil: 'domcontentloaded' });
const email = `probe-hub-${Date.now()}@example.com`;
await page.locator('input[placeholder="How should we address you?"]').fill('Hub Probe');
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[placeholder="At least 10 characters"]').fill('Px' + Math.random().toString(36).slice(2) + 'Qz9#Top8!');
await page.locator('button:has-text("Create account")').click();
await page.waitForURL(/\/app/, { timeout: 15000 });
console.log('signed up ->', page.url());

// go straight to hub
const t0 = Date.now();
await page.goto('http://localhost:5173/app/learning', { waitUntil: 'domcontentloaded' });
const reads = [];
for (let i = 0; i < 8; i += 1) {
  await page.waitForTimeout(2000);
  reads.push({
    at: Date.now() - t0,
    text: (await page.evaluate(() => document.body.innerText)).replace(/\n/g, ' | ').slice(0, 260),
    hasOverview: await page.evaluate(() => !!document.querySelector('.learn-overview')),
  });
}
console.log(JSON.stringify(reads, null, 2));
await page.screenshot({ path: path.join(SHOT, 'repro-hub.png'), fullPage: true });
console.log(JSON.stringify(apiLog, null, 2));
await browser.close();
