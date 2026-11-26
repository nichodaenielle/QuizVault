# QuizVault

A professional online reviewer, quiz, and exam platform. Learners join sections
with class codes, take reviewer/quiz/exam assessments built from a reusable
question bank, and see released results. Instructors author questions, sets, and
versioned assessments, publish them to sections, and grade essays. Admins manage
roles and platform records.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) + **React 19**
- **Tailwind CSS 4** — forest green / ivory academic theme
- **PostgreSQL** via `embedded-postgres` for local dev (no Docker needed)
- **Prisma 7** (`@prisma/client` + `@prisma/adapter-pg`) with real migrations
- **Google OAuth** (custom flow, `jose` JWT sessions) — no external auth service

## Local setup

```bash
npm install
cp .env.example .env        # then fill in values (see below)
npm run db:start            # starts embedded PostgreSQL on :5432 (first run initialises .pgdata)
npm run db:setup            # applies prisma/migrations
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.
DB helpers: `npm run db:start | db:stop | db:status` (`node scripts/db.mjs`).

### Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string, e.g. `postgres://postgres:postgres@localhost:5432/quizvault` |
| `AUTH_SECRET` | Long random string used to sign session JWTs (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials (see below) |
| `FIRST_ADMIN_EMAIL` | Verified Google email that becomes ADMIN on first sign-in |
| `NEXTAUTH_URL` | Public base URL (used for OAuth redirect; `http://localhost:3000` locally) |
| `DEV_AUTH` | `1` enables a dev-only sign-in bypass (`POST /api/auth/dev`). Never enable in production. |

### Google OAuth configuration

1. In [Google Cloud Console](https://console.cloud.google.com) create an OAuth 2.0
   client ID (type: Web application).
2. Add authorized redirect URI:
   `http://localhost:3000/api/auth/google/callback` (and your production origin).
3. Put the client ID/secret in `.env`.

### First admin provisioning

Set `FIRST_ADMIN_EMAIL` to the Google account email of the person who should be
the first administrator. When that email signs in for the first time they are
created with role `ADMIN`. Afterwards, admins grant/revoke roles under
**Admin → Users**; every change is recorded in `RoleChange` + `AuditLog`.

### Dev sign-in bypass

With `DEV_AUTH=1` (and `NODE_ENV !== production`), `POST /api/auth/dev` with
`{"email","name","role"}` creates/signs in a user without Google. The sign-in
page shows a dev-login form when enabled. This is for local verification only.

## Roles

- **Learner** (default): join sections via codes, take assignments, view own
  progress and released results.
- **Instructor**: manage assigned sections, question bank/sets/assessments,
  publish to sections, grade essays, view roster progress.
- **Admin**: everything an instructor can do, plus user role management and
  platform-wide section/assessment views.

## How it works (key flows)

- **Sections & codes**: each section has a unique random join code. Instructors
  and admins can rotate/disable/expire codes; invalid attempts are rate-limited
  (`JoinAttempt`) and duplicate enrollments are blocked by a unique constraint.
- **Question bank**: six types — TRUE_FALSE, MULTIPLE_CHOICE, MULTIPLE_SELECT
  (exact-set matching), SHORT_ANSWER and IDENTIFICATION (acceptable-answer
  lists, optional case sensitivity, trimmed/normalized comparison), and ESSAY
  (word limit, rubric criteria, manual grading). Payloads are validated before
  save/publish.
- **Assessments**: built from individual questions, whole sets, or random draws.
  Publishing snapshots items + settings into an immutable `AssessmentVersion`;
  attempts pin `versionId`, so later edits never change existing attempts
  (verified: editing a bank question leaves prior attempt content/scores intact).
- **Modes**: REVIEWER (self-paced, hints/explanations, repeat), QUIZ (attempt
  limits, optional timer), EXAM (opens/closes window, shuffle, release rules).
  Per-assignment settings can override; the earlier of duration vs. closing
  time wins.
- **Attempts**: server timestamps enforce windows; autosave upserts
  `Response` rows by `(attemptId, itemKey)`; the runner preserves per-attempt
  item/option order; submit is idempotent (unique `idempotencyKey`, status
  transition guarded). A 30s sweeper (`src/instrumentation.ts`) plus
  opportunistic checks finalize expired attempts even if the tab is closed.
- **Grading**: objective items auto-grade at submit; essays go to
  `PENDING_GRADING` and appear in the instructor grading queue with rubric
  scores + feedback. `recomputeAttemptScore` rolls up partial + manual scores.
- **Release rules**: scores/correct answers/explanations/feedback visibility is
  controlled per assignment (`feedbackRelease`, optional `releaseAt`).
- **Progress**: learner dashboard shows sections, assignments, in-progress
  attempts, released results; completion rate = submitted ÷ published
  assignments available (excluding future). Instructors get roster, per-learner
  progress, score history, and topic performance. Reviewer scores are tracked
  separately from graded quiz/exam scores.

## Verification performed

- `tsc --noEmit` clean, `eslint` clean, `next build` succeeds (all routes dynamic).
- E2E via dev-auth + real HTTP against the embedded Postgres:
  - dev sign-in for learner/instructor/admin; role guards redirect correctly
    (learner → `/teach` or `/admin` denied).
  - Attempt start → autosave (all 6 question types) → submit; repeat submit is
    idempotent (same `submittedAt`, no duplicate).
  - Mixed assessment scored 8/13 auto + essay pending → `PENDING_GRADING`;
    after essay grade, recomputed to 12/13 `GRADED`; results page shows score,
    per-item review, and instructor feedback.
  - Deadline expiry: backdated `deadlineAt`, sweeper finalized the attempt with
    last saved answers (score 6/13) while "browser closed".
  - Access control: cross-learner attempt GET → 404; unauthenticated API →
    sign-in redirect; instructor cannot start a learner attempt (403).
  - Snapshot integrity: editing a bank question did not change a published
    attempt's items.
- **Not verified**: live Google sign-in (no OAuth credentials in this
  environment) and browser-level click-through of server-action forms
  (authoring/publish/join UIs are typechecked and build cleanly but were
  exercised at the data/API layer, e.g. `scripts/e2e-seed.mjs` mirrors the
  publish snapshot shape).

An E2E fixture script is included: `node scripts/e2e-seed.mjs` (requires
`DATABASE_URL`) seeds a section, join code, all six question types, a set, and a
published QUIZ assignment; `scripts/e2e-grade.ts` simulates essay grading.

## Deploying to Vercel

The app deploys to Vercel as-is (Next.js + Node runtime).

1. **Push to GitHub** and import the repo at [vercel.com/new](https://vercel.com/new).
   Framework preset: Next.js. Build command `npm run build` works unchanged.
2. **Database**: provision hosted Postgres (Vercel Marketplace → Neon, or any
   Postgres). Set `DATABASE_URL` to the **pooled** connection string.
3. **Env vars** (Project → Settings → Environment Variables):
   `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `FIRST_ADMIN_EMAIL`, `NEXTAUTH_URL` = `https://<your-app>.vercel.app`,
   `CRON_SECRET` = a long random string.
4. **Run migrations once** from your machine:
   `DATABASE_URL=<prod-url> npx prisma migrate deploy`
5. **Google OAuth**: add `https://<your-app>.vercel.app/api/auth/google/callback`
   to the OAuth client's authorized redirect URIs. While the consent screen is in
   "Testing" mode, add client/demo Gmail addresses as test users (or publish the
   app — `email`/`profile` scopes need no verification).
6. **Expired-attempt sweeper**: `vercel.json` registers a daily cron
   (`0 3 * * *` → `/api/cron/finalize`). On the Hobby plan crons run at most once
   per day within the hour; for tighter expiry enforcement use any external
   scheduler (cron-job.org, GitHub Actions `schedule:`) hitting
   `GET /api/cron/finalize` every few minutes with header
   `Authorization: Bearer $CRON_SECRET`. Attempts also finalize lazily on the
   next request regardless, so this is a safety net, not a hard dependency.
7. `DEV_AUTH` must stay unset/`0` in production — dev login is disabled
   automatically when `NODE_ENV=production`.
