// Admin-only screenshot pass (run after screenshots.mjs).
import { chromium } from 'playwright-core';
import path from 'node:path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000';
const OUT = path.resolve('public/manual/img');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const res = await ctx.request.post(`${BASE}/api/auth/dev`, {
  data: { email: 'daenielledaypuyart@gmail.com', name: 'Daenielle Daypuyart', role: 'ADMIN' },
});
if (!res.ok()) throw new Error(`dev auth failed: ${res.status()} ${await res.text()}`);

for (const [url, name] of [
  ['/admin', 'admin-dashboard'],
  ['/admin/users', 'admin-users'],
  ['/admin/sections', 'admin-sections'],
  ['/admin/invites', 'admin-invites'],
  ['/admin/activity', 'admin-activity'],
  ['/teach', 'admin-teach-dashboard'],
]) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
  await page.close();
}
await browser.close();
