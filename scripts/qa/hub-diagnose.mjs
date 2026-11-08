/* Diagnose Learning Hub hang through the Vite dev proxy. */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/acer/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const pw = require('playwright');

const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext()).newPage();
const log = [];
page.on('request', (r) => { if (r.url().includes('/api/learning')) log.push({ ev: 'req', t: Date.now(), url: r.url() }); });
page.on('response', (r) => { if (r.url().includes('/api/learning')) log.push({ ev: 'res', t: Date.now(), url: r.url(), status: r.status() }); });
page.on('requestfinished', (r) => { if (r.url().includes('/api/learning')) log.push({ ev: 'fin', t: Date.now(), url: r.url() }); });
page.on('requestfailed', (r) => { if (r.url().includes('/api/learning')) log.push({ ev: 'fail', t: Date.now(), url: r.url(), err: r.failure()?.errorText }); });
page.on('response', (r) => { if (r.url().includes('/api/learning/volumes')) r.text().then((b) => log.push({ ev: 'body', len: b.length, head: b.slice(0, 80) })).catch(() => {}); });

const t0 = Date.now();
await page.goto('http://localhost:5173/app/learning', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(25000);
const state = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 300),
  hasOverview: !!document.querySelector('.learn-overview'),
  loader: !!document.querySelector('[role="status"], .loader'),
}));
console.log(JSON.stringify({ elapsed: Date.now() - t0, state, log }, null, 2));
await browser.close();
