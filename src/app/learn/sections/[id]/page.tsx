import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import type { Snapshot } from '@/lib/questions';
import { startAttemptAction } from '@/lib/actions/attempts';

export const dynamic = 'force-dynamic';

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  const { id } = await params;
  const { error } = await searchParams;

  const enrollment = await prisma.enrollment.findUnique({
    where: { sectionId_userId: { sectionId: id, userId: user.id } },
    include: {
      section: {
        include: {
          instructors: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });
  if (!enrollment) notFound();
  const section = enrollment.section;

  const now = new Date();
  const assignments = await prisma.sectionAssignment.findMany({
    where: { sectionId: id, assessment: { status: 'PUBLISHED' }, versionId: { not: null } },
    include: {
      assessment: { select: { id: true, title: true, mode: true } },
      version: { select: { snapshot: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const attempts = await prisma.attempt.findMany({
    where: { userId: user.id, assignmentId: { in: assignments.map((a) => a.id) } },
    orderBy: { attemptNumber: 'desc' },
  });
  const byAssignment = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const l = byAssignment.get(a.assignmentId) ?? [];
    l.push(a);
    byAssignment.set(a.assignmentId, l);
  }

  return (
    <AppShell user={user} nav={[{ href: '/learn', label: 'Dashboard' }, { href: '/learn/join', label: 'Join section' }]}>
      <PageHeader
        title={section.name}
        subtitle={`Taught by ${section.instructors.map((i) => i.user.name ?? i.user.email).join(', ') || '—'}`}
      />
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {section.description && <p className="mb-4 text-sm text-ink-600">{section.description}</p>}

      <h2 className="mb-3 text-lg font-semibold text-ink-900">Assignments</h2>
      {assignments.length === 0 ? (
        <EmptyState title="No assignments published yet" body="Check back later." />
      ) : (
        <ul className="space-y-3">
          {assignments.map((asg) => {
            const mine = byAssignment.get(asg.id) ?? [];
            const inProgress = mine.find((m) => m.status === 'IN_PROGRESS');
            const latest = mine[0];
            const open = (!asg.opensAt || asg.opensAt <= now) && (!asg.closesAt || asg.closesAt >= now);
            const used = mine.length;
            const snap = asg.version?.snapshot as Snapshot | null;
            return (
              <li key={asg.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={asg.assessment.mode === 'EXAM' ? 'red' : asg.assessment.mode === 'QUIZ' ? 'green' : 'neutral'}>
                        {asg.assessment.mode}
                      </Badge>
                      {inProgress && <Badge tone="blue">In progress</Badge>}
                      {latest?.status === 'SUBMITTED' && (
                        <Badge tone={latest.gradingStatus === 'GRADED' || latest.gradingStatus === 'AUTO_GRADED' ? 'green' : 'gold'}>
                          {latest.gradingStatus === 'PENDING_GRADING' ? 'Pending grading' : 'Submitted'}
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-1 font-medium text-ink-900">{asg.assessment.title}</h3>
                    <p className="text-sm text-ink-600">
                      {snap?.items.length ?? 0} questions · {used}/{asg.attemptLimit} attempts used
                      {asg.closesAt ? ` · closes ${formatDateTime(asg.closesAt, user.timezone)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {inProgress ? (
                      <Link href={`/learn/attempts/${inProgress.id}`} className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-pine-800">
                        Resume
                      </Link>
                    ) : open && used < asg.attemptLimit ? (
                      <form action={startAttemptAction.bind(null, asg.id, `/learn/sections/${id}`)}>
                        <button type="submit" className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-pine-800">
                          Start
                        </button>
                      </form>
                    ) : latest?.status === 'SUBMITTED' ? (
                      <Link href={`/learn/results/${latest.id}`} className="rounded-lg bg-pine-100 px-4 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50">
                        View result
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
