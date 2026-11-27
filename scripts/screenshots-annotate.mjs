// Re-captures key manual screenshots with numbered hotspot badges injected
// over the real UI elements. Run after screenshots.mjs (dev server + DEV_AUTH).
import { chromium } from 'playwright-core';
import path from 'node:path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000';
const OUT = path.resolve('public/manual/img');

const IDS = {
  sectionId: 'cmwyjle2w000290v6ok6c27y8',
  assignmentId: 'cmwyjle4b000e90v6hiy4d2t7',
};

// name -> { url, role context, hotspots: [{sel, n}] }
const SPECS = {
  'common-sign-in': {
    url: '/sign-in', auth: null,
    spots: [
      ['text=Sign in to QuizVault', 1],
      ['text=Continue with Google', 2],
      ['text=Request to join a section', 3],
    ],
  },
  'learner-dashboard': {
    url: '/learn', auth: ['learner@e2e.local', 'E2E Learner', 'LEARNER'],
    spots: [
      ['text=My sections', 1],
      ['text=/Up next|Coming up/', 2],
    ],
  },
  'learner-join': {
    url: '/learn/join', auth: ['learner@e2e.local', 'E2E Learner', 'LEARNER'],
    spots: [
      ['css=input[placeholder="Enter class code"]', 1],
      ['role=button[name="Join section"]', 2],
    ],
  },
  'learner-runner': {
    url: `/learn/attempts/__PROGRESS__`, auth: ['learner@e2e.local', 'E2E Learner', 'LEARNER'],
    needsAttempt: 'progress',
    spots: [
      ['css=aside[aria-label="Question navigation"]', 1],
      ['role=button[name="Submit"]', 2],
    ],
  },
  'learner-results': {
    url: `/learn/results/__SUBMITTED__`, auth: ['learner@e2e.local', 'E2E Learner', 'LEARNER'],
    needsAttempt: 'submitted',
    spots: [
      ['text=Score', 1],
      ['text=Review', 2],
    ],
  },
  'instructor-dashboard': {
    url: '/teach', auth: ['instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR'],
    spots: [
      ['text=Needs attention', 1],
      ['text=Assessments', 2],
    ],
  },
  'instructor-questions': {
    url: '/teach/questions', auth: ['instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR'],
    spots: [
      ['text=New question', 1],
    ],
  },
  'instructor-question-new': {
    url: '/teach/questions/new', auth: ['instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR'],
    spots: [
      ['text=Question type', 1],
      ['css=#prompt', 2],
    ],
  },
  'instructor-assessments': {
    url: '/teach/assessments', auth: ['instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR'],
    spots: [
      ['text=New assessment', 1],
    ],
  },
  'instructor-section-detail': {
    url: `/teach/sections/${IDS.sectionId}`, auth: ['instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR'],
    spots: [
      ['text=Class code', 1],
      ['role=table', 2],
    ],
  },
  'instructor-grading': {
    url: '/teach/grading', auth: ['instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR'],
    spots: [
      ['text=Grading queue', 1],
    ],
  },
  'admin-dashboard': {
    url: '/admin', auth: ['daenielledaypuyart@gmail.com', 'Daenielle Daypuyart', 'ADMIN'],
    spots: [
      ['text=Users by role', 1],
      ['text=Recent activity', 2],
    ],
  },
  'admin-users': {
    url: '/admin/users', auth: ['daenielledaypuyart@gmail.com', 'Daenielle Daypuyart', 'ADMIN'],
    spots: [
      ['role=table', 1],
    ],
  },
  'admin-activity': {
    url: '/admin/activity', auth: ['daenielledaypuyart@gmail.com', 'Daenielle Daypuyart', 'ADMIN'],
    spots: [
      ['text=Download .txt', 1],
      ['css=#q', 2],
    ],
  },
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const misses = [];

async function login(ctx, [email, name, role]) {
  const res = await ctx.request.post(`${BASE}/api/auth/dev`, { data: { email, name, role } });
  if (!res.ok()) throw new Error(`auth ${email}: ${res.status()}`);
}

// find the learner's submitted attempt for results/runner shots
const { PrismaClient } = await import('@prisma/client');
const { PrismaPg } = await import('@prisma/adapter-pg');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const submittedAttempt = await prisma.attempt.findFirst({
  where: { assignmentId: IDS.assignmentId, status: 'SUBMITTED' },
  orderBy: { submittedAt: 'desc' },
});
const progressAttempt = await prisma.attempt.findFirst({
  where: { user: { email: 'learner@e2e.local' }, status: 'IN_PROGRESS' },
  orderBy: { startedAt: 'desc' },
});
console.log('attempts:', { submitted: submittedAttempt?.id, progress: progressAttempt?.id });
await prisma.$disconnect();

for (const [name, spec] of Object.entries(SPECS)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    if (spec.auth) await login(ctx, spec.auth);
    const page = await ctx.newPage();

    let url = spec.url;
    if (spec.needsAttempt) {
      let aid = spec.needsAttempt === 'progress' ? progressAttempt?.id : submittedAttempt?.id;
      if (!aid) { console.log('SKIP', name, '(no attempt)'); continue; }
      url = url.replace('__PROGRESS__', aid).replace('__SUBMITTED__', aid);
      if (name === 'learner-results') {
        await ctx.request.post(`${BASE}/api/attempts/${aid}/submit`).catch(() => {});
      }
    }

    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // inject numbered badges
    const boxes = [];
    for (const [sel, n] of spec.spots) {
      try {
        const box = await page.locator(sel).first().boundingBox({ timeout: 3000 });
        if (box) boxes.push({ n, x: box.x + box.width / 2, y: box.y + box.height / 2 });
        else misses.push(`${name}: ${sel}`);
      } catch { misses.push(`${name}: ${sel}`); }
    }
    await page.evaluate((items) => {
      const layer = document.createElement('div');
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
      for (const { n, x, y } of items) {
        const d = document.createElement('div');
        d.textContent = String(n);
        d.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:9999px;background:#9a7f45;color:#fff;font:700 15px/30px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.4)`;
        layer.appendChild(d);
      }
      document.body.appendChild(layer);
    }, boxes);

    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('shot', name, `(${boxes.length}/${spec.spots.length} badges)`);
    await page.close();
  } catch (e) {
    console.log('FAIL', name, e.message.split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

await browser.close();
if (misses.length) { console.log('\nMissed selectors:'); misses.forEach((m) => console.log(' -', m)); }
