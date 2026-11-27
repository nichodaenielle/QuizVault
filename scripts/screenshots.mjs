// Captures manual screenshots against the local dev server using Edge via
// playwright-core. Run: node scripts/screenshots.mjs  (dev server must be up,
// DEV_AUTH=1, DATABASE_URL set)
import { chromium } from 'playwright-core';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000';
const OUT = path.resolve('public/manual/img');
fs.mkdirSync(OUT, { recursive: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const [question, section, assignment, assessment, set, learnerUser] =
  await Promise.all([
    prisma.question.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.section.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.sectionAssignment.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.assessment.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.questionSet.findFirst({ orderBy: { createdAt: 'asc' } }),
    prisma.user.findFirst({ where: { role: 'LEARNER' } }),
  ]);

const ids = {
  questionId: question?.id,
  sectionId: section?.id,
  assignmentId: assignment?.id,
  assessmentId: assessment?.id,
  setId: set?.id,
  learnerId: learnerUser?.id,
};
console.log('IDs:', ids);

const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function newSession(email, name, role) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const res = await ctx.request.post(`${BASE}/api/auth/dev`, {
    data: { email, name, role },
  });
  if (!res.ok()) throw new Error(`dev auth failed for ${email}: ${res.status()}`);
  return ctx;
}

async function shot(ctx, url, name, opts = {}) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(opts.wait ?? 400);
  if (opts.before) await opts.before(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.full });
  console.log('shot', name);
  await page.close();
}

const results = [];
async function tryShot(...args) {
  try { await shot(...args); results.push([args[1], 'ok']); }
  catch (e) { results.push([args[1], `FAIL ${e.message.split('\n')[0]}`]); }
}

// ---------- logged out ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await tryShot(ctx, '/sign-in', 'common-sign-in');
  await ctx.close();
}

// ---------- learner ----------
{
  const ctx = await newSession('learner@e2e.local', 'E2E Learner', 'LEARNER');
  await tryShot(ctx, '/learn', 'learner-dashboard');
  await tryShot(ctx, '/learn/join', 'learner-join');
  if (ids.sectionId) await tryShot(ctx, `/learn/sections/${ids.sectionId}`, 'learner-section');

  // start + screenshot the attempt runner, then submit and capture results
  if (ids.assignmentId) {
    const start = await ctx.request.post(`${BASE}/api/assignments/${ids.assignmentId}/start`);
    let attemptId = null;
    if (start.ok()) {
      const body = await start.json();
      attemptId = body.attempt?.id ?? body.id ?? null;
      if (!attemptId) {
        const att = await prisma.attempt.findFirst({
          where: { assignmentId: ids.assignmentId, userId: ids.learnerId },
          orderBy: { startedAt: 'desc' },
        });
        attemptId = att?.id ?? null;
      }
    }
    if (attemptId) {
      await tryShot(ctx, `/learn/attempts/${attemptId}`, 'learner-runner');
      // answer nothing; submit to reach results (auto-graded questions score 0)
      await ctx.request.post(`${BASE}/api/attempts/${attemptId}/submit`).catch(() => {});
      await tryShot(ctx, `/learn/results/${attemptId}`, 'learner-results');
    } else {
      results.push(['/learn/attempts/*', 'FAIL no attempt']);
    }
  }
  await ctx.close();
}

// ---------- instructor ----------
{
  const ctx = await newSession('instructor@e2e.local', 'E2E Instructor', 'INSTRUCTOR');
  await tryShot(ctx, '/teach', 'instructor-dashboard');
  await tryShot(ctx, '/teach/questions', 'instructor-questions');
  await tryShot(ctx, '/teach/questions/new', 'instructor-question-new');
  if (ids.questionId) await tryShot(ctx, `/teach/questions/${ids.questionId}`, 'instructor-question-edit');
  await tryShot(ctx, '/teach/sets', 'instructor-sets');
  if (ids.setId) await tryShot(ctx, `/teach/sets/${ids.setId}`, 'instructor-set-detail', { full: true });
  await tryShot(ctx, '/teach/assessments', 'instructor-assessments');
  await tryShot(ctx, '/teach/assessments/new', 'instructor-assessment-new');
  if (ids.assessmentId) await tryShot(ctx, `/teach/assessments/${ids.assessmentId}`, 'instructor-assessment-studio', { full: true });
  await tryShot(ctx, '/teach/sections', 'instructor-sections');
  if (ids.sectionId) await tryShot(ctx, `/teach/sections/${ids.sectionId}`, 'instructor-section-detail');
  await tryShot(ctx, '/teach/grading', 'instructor-grading');
  await tryShot(ctx, '/teach/invites', 'instructor-invites');
  await ctx.close();
}

// ---------- admin ----------
{
  const ctx = await newSession('daenielledaypuyart@gmail.com', 'Daenielle Daypuyart', 'ADMIN');
  await tryShot(ctx, '/admin', 'admin-dashboard');
  await tryShot(ctx, '/admin/users', 'admin-users');
  await tryShot(ctx, '/admin/sections', 'admin-sections');
  await tryShot(ctx, '/admin/invites', 'admin-invites');
  await tryShot(ctx, '/admin/activity', 'admin-activity');
  // admin is also an instructor — capture teach dashboard in admin view too
  await tryShot(ctx, '/teach', 'admin-teach-dashboard');
  await ctx.close();
}

console.log('\nResults:');
for (const [n, s] of results) console.log(` ${s === 'ok' ? 'OK ' : 'ERR'} ${n} ${s === 'ok' ? '' : s}`);

await browser.close();
await prisma.$disconnect();
