import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { startAttemptAction } from '@/lib/actions/attempts';

export const dynamic = 'force-dynamic';

const MODE_LABEL: Record<string, string> = {
  REVIEWER: 'Reviewer',
  QUIZ: 'Quiz',
  EXAM: 'Exam',
};

export default async function LearnPage() {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  const now = new Date();

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: { section: { include: { instructors: { include: { user: { select: { name: true } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const sectionIds = enrollments.map((e) => e.sectionId);

  const assignments = await prisma.sectionAssignment.findMany({
    where: {
      sectionId: { in: sectionIds },
      assessment: { status: 'PUBLISHED' },
      versionId: { not: null },
    },
    include: {
      assessment: { select: { id: true, title: true, mode: true, status: true } },
      section: { select: { id: true, name: true } },
      version: { select: { snapshot: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const attempts = await prisma.attempt.findMany({
    where: { userId: user.id, assignmentId: { in: assignments.map((a) => a.id) } },
    orderBy: { attemptNumber: 'desc' },
  });
  const attemptsByAssignment = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = attemptsByAssignment.get(a.assignmentId) ?? [];
    list.push(a);
    attemptsByAssignment.set(a.assignmentId, list);
  }

  const recentResults = attempts
    .filter((a) => a.status === 'SUBMITTED')
    .slice(0, 5);

  // Average score across recent graded attempts (percentage).
  const graded = attempts.filter((a) => a.status === 'SUBMITTED' && a.score != null && a.maxScore);
  const avgScore = graded.length
    ? Math.round(graded.reduce((s, a) => s + (a.score! / a.maxScore!) * 100, 0) / graded.length)
    : null;
  const pendingGrading = attempts.filter((a) => a.gradingStatus === 'PENDING_GRADING').length;

  const rows = assignments.map((asg) => {
    const mine = attemptsByAssignment.get(asg.id) ?? [];
    const open =
      (!asg.opensAt || asg.opensAt <= now) && (!asg.closesAt || asg.closesAt >= now);
    const inProgress = mine.find((m) => m.status === 'IN_PROGRESS');
    const submitted = mine.filter((m) => m.status === 'SUBMITTED');
    const used = submitted.length + (inProgress ? 1 : 0);
    let status: string;
    let tone: 'neutral' | 'green' | 'gold' | 'red' | 'blue' = 'neutral';
    if (inProgress) {
      status = 'In progress';
      tone = 'blue';
    } else if (used >= asg.attemptLimit && asg.attemptLimit > 0) {
      status = submitted.some((s) => s.gradingStatus === 'GRADED' || s.gradingStatus === 'AUTO_GRADED')
        ? 'Completed'
        : 'Submitted';
      tone = 'green';
    } else if (!open) {
      status = asg.closesAt && asg.closesAt < now ? 'Closed' : 'Opens later';
      tone = 'neutral';
    } else {
      status = 'Available';
      tone = 'gold';
    }
    const snap = asg.version?.snapshot as { items?: unknown[] } | null;
    const itemCount = snap?.items?.length ?? 0;
    const deadline = inProgress?.deadlineAt;
    const overdue = inProgress?.deadlineAt && inProgress.deadlineAt < now;
    return { asg, mine, inProgress, submitted, status, tone, itemCount, open, deadline, overdue };
  });

  const inProgressCount = rows.filter((r) => r.inProgress).length;
  const completedCount = rows.filter((r) => !r.inProgress && r.submitted.length > 0 && r.submitted.length + (r.inProgress ? 1 : 0) >= r.asg.attemptLimit).length;

  // "Up next": soonest deadline among in-progress attempts, else soonest opening.
  const activeAttempts = rows.filter((r) => r.inProgress && r.deadline);
  const nextDeadline = activeAttempts.sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0];
  const upcoming = rows
    .filter((r) => !r.open && r.asg.opensAt && r.asg.opensAt > now)
    .sort((a, b) => a.asg.opensAt!.getTime() - b.asg.opensAt!.getTime())[0];
  const upNext = nextDeadline
    ? { kind: 'resume' as const, title: nextDeadline.asg.assessment.title, attemptId: nextDeadline.inProgress!.id, when: nextDeadline.deadline!, overdue: !!nextDeadline.overdue }
    : upcoming
      ? { kind: 'opens' as const, title: upcoming.asg.assessment.title, when: upcoming.asg.opensAt!, section: upcoming.asg.section.name }
      : null;

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/learn', label: 'Dashboard' },
        { href: '/learn/join', label: 'Join section' },
      ]}
    >
      <PageHeader
        title={`Welcome back, ${user.name?.split(' ')[0] ?? 'Learner'}`}
        subtitle="Your sections, assignments, and results."
        actions={<LinkButton href="/learn/join" variant="secondary">Join a section</LinkButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="My sections" value={enrollments.length} />
        <StatCard label="In progress" value={inProgressCount} tone={inProgressCount ? 'blue' : 'neutral'} />
        <StatCard label="Completed" value={completedCount} tone="green" />
        <StatCard
          label="Average score"
          value={avgScore == null ? '—' : `${avgScore}%`}
          hint={pendingGrading ? `${pendingGrading} awaiting grading` : undefined}
          tone="gold"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="assignments">
            <h2 id="assignments" className="mb-3 text-lg font-semibold text-ink-900">
              Assignments
            </h2>
            {rows.length === 0 ? (
              <EmptyState
                title="No assignments yet"
                body="Join a section with a class code to see assignments."
                action={<LinkButton href="/learn/join">Enter class code</LinkButton>}
              />
            ) : (
              <ul className="space-y-3">
                {rows.map(({ asg, inProgress, submitted, status, tone, itemCount, open, deadline, overdue }) => {
                  const latestScore = submitted[0]?.score != null ? submitted[0] : null;
                  return (
                  <li key={asg.id}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={asg.assessment.mode === 'EXAM' ? 'red' : asg.assessment.mode === 'QUIZ' ? 'green' : 'neutral'}>
                              {MODE_LABEL[asg.assessment.mode]}
                            </Badge>
                            <Badge tone={tone}>{status}</Badge>
                          </div>
                          <h3 className="mt-2 font-medium text-ink-900">{asg.assessment.title}</h3>
                          <p className="text-sm text-ink-600">
                            {asg.section.name} · {itemCount} questions
                            {asg.timeLimitSec ? ` · ${Math.round(asg.timeLimitSec / 60)} min` : ''}
                            {asg.closesAt ? ` · closes ${formatDateTime(asg.closesAt, user.timezone)}` : ''}
                            {latestScore ? ` · Score ${latestScore.score}/${latestScore.maxScore}` : ''}
                          </p>
                          {inProgress && deadline && (
                            <p className={`mt-1 text-sm font-medium ${overdue ? 'text-red-700' : 'text-pine-800'}`}>
                              {overdue ? 'Time expired — will be finalized' : `Deadline ${formatDateTime(deadline, user.timezone)}`}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {inProgress ? (
                            <LinkButton href={`/learn/attempts/${inProgress.id}`} variant="primary">
                              Resume
                            </LinkButton>
                          ) : open ? (
                            <form action={startAttemptAction.bind(null, asg.id, '/learn')}>
                              <button
                                type="submit"
                                className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-pine-800"
                              >
                                Start
                              </button>
                            </form>
                          ) : null}
                          <Link
                            href={`/learn/sections/${asg.sectionId}`}
                            className="rounded-lg px-3 py-2 text-sm text-pine-900 hover:bg-pine-100"
                          >
                            Section
                          </Link>
                        </div>
                      </div>
                    </Card>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {upNext && (
            <Card className="border-gold-500/40 bg-gold-100/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                {upNext.kind === 'resume' ? 'Up next — resume' : 'Coming up'}
              </p>
              <p className="mt-1 font-medium text-ink-900">{upNext.title}</p>
              <p className="mt-0.5 text-sm text-ink-600">
                {upNext.kind === 'resume'
                  ? upNext.overdue
                    ? 'Deadline passed — will be finalized'
                    : `Deadline ${formatDateTime(upNext.when, user.timezone)}`
                  : `Opens ${formatDateTime(upNext.when, user.timezone)} · ${upNext.section}`}
              </p>
              {upNext.kind === 'resume' && (
                <Link
                  href={`/learn/attempts/${upNext.attemptId}`}
                  className="mt-3 inline-block rounded-lg bg-pine-900 px-3 py-1.5 text-sm font-medium text-ivory-50 hover:bg-pine-800"
                >
                  Resume now
                </Link>
              )}
            </Card>
          )}
          <section aria-labelledby="sections">
            <h2 id="sections" className="mb-3 text-lg font-semibold text-ink-900">My sections</h2>
            {enrollments.length === 0 ? (
              <Card className="p-4 text-sm text-ink-600">You haven&apos;t joined any sections yet.</Card>
            ) : (
              <ul className="space-y-2">
                {enrollments.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/learn/sections/${e.sectionId}`}
                      className="block rounded-xl border border-ink-400/15 bg-ivory-100 p-4 hover:border-pine-800/40"
                    >
                      <p className="font-medium text-ink-900">{e.section.name}</p>
                      <p className="text-sm text-ink-600">
                        {e.section.instructors.map((i) => i.user.name).filter(Boolean).join(', ') || 'Instructor'}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="results">
            <h2 id="results" className="mb-3 text-lg font-semibold text-ink-900">Recent results</h2>
            {recentResults.length === 0 ? (
              <Card className="p-4 text-sm text-ink-600">No submitted work yet.</Card>
            ) : (
              <ul className="space-y-2">
                {recentResults.map((a) => {
                  const asg = assignments.find((x) => x.id === a.assignmentId);
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/learn/results/${a.id}`}
                        className="block rounded-xl border border-ink-400/15 bg-ivory-100 p-4 hover:border-pine-800/40"
                      >
                        <p className="font-medium text-ink-900">{asg?.assessment.title ?? 'Assessment'}</p>
                        <p className="text-sm text-ink-600">
                          {a.gradingStatus === 'PENDING_GRADING'
                            ? 'Awaiting grading'
                            : a.score != null
                              ? `Score ${a.score}/${a.maxScore}`
                              : 'Submitted'}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
