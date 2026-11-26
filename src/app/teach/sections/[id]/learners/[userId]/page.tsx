import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { canManageSection } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { orderItems } from '@/lib/attempts';
import type { Snapshot } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default async function LearnerProgressPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const { id, userId } = await params;
  if (!(await canManageSection(user, id))) notFound();

  const [section, learner, enrollment] = await Promise.all([
    prisma.section.findUnique({ where: { id }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.enrollment.findUnique({
      where: { sectionId_userId: { sectionId: id, userId } },
    }),
  ]);
  if (!section || !learner) notFound();

  const now = new Date();
  const assignments = await prisma.sectionAssignment.findMany({
    where: { sectionId: id, assessment: { status: 'PUBLISHED' }, versionId: { not: null } },
    include: {
      assessment: { select: { title: true, mode: true, status: true } },
      version: { select: { snapshot: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const attempts = await prisma.attempt.findMany({
    where: { userId, assignmentId: { in: assignments.map((a) => a.id) } },
    include: { responses: true, version: true },
    orderBy: [{ assignmentId: 'asc' }, { attemptNumber: 'asc' }],
  });
  const byAssignment = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const l = byAssignment.get(a.assignmentId) ?? [];
    l.push(a);
    byAssignment.set(a.assignmentId, l);
  }

  // Per-assignment status.
  type Row = {
    asg: (typeof assignments)[number];
    status: string;
    tone: 'neutral' | 'green' | 'gold' | 'red' | 'blue';
    attempts: typeof attempts;
  };
  const rows: Row[] = assignments.map((asg) => {
    const mine = byAssignment.get(asg.id) ?? [];
    const submitted = mine.filter((m) => m.status === 'SUBMITTED');
    const inProgress = mine.find((m) => m.status === 'IN_PROGRESS');
    const windowClosed = (asg.closesAt && asg.closesAt < now) || asg.assessment.status !== 'PUBLISHED';
    const windowFuture = asg.opensAt && asg.opensAt > now;
    let status = 'Not started';
    let tone: Row['tone'] = 'neutral';
    if (inProgress) { status = 'In progress'; tone = 'blue'; }
    else if (submitted.length > 0) {
      const latest = submitted[submitted.length - 1];
      status = latest.gradingStatus === 'PENDING_GRADING' ? 'Pending grading' : 'Graded';
      tone = latest.gradingStatus === 'PENDING_GRADING' ? 'gold' : 'green';
    } else if (windowFuture) { status = 'Upcoming'; }
    else if (windowClosed && mine.length >= asg.attemptLimit) { status = 'Missed'; tone = 'red'; }
    else if (windowClosed) { status = 'Missed'; tone = 'red'; }
    return { asg, status, tone, attempts: mine };
  });

  // Completion rate: submitted / published assignments available (excludes future).
  const available = rows.filter((r) => !(r.asg.opensAt && r.asg.opensAt > now));
  const submittedCount = available.filter((r) => r.attempts.some((a) => a.status === 'SUBMITTED')).length;
  const completionRate = available.length ? Math.round((submittedCount / available.length) * 100) : null;

  // Performance by topic across graded attempts.
  const topicStats = new Map<string, { earned: number; possible: number; count: number }>();
  for (const a of attempts) {
    if (a.status !== 'SUBMITTED' || (a.gradingStatus !== 'GRADED' && a.gradingStatus !== 'AUTO_GRADED')) continue;
    const snap = a.version?.snapshot as unknown as Snapshot | null;
    if (!snap) continue;
    const items = orderItems(snap.items, a.itemOrder);
    const respByKey = new Map(a.responses.map((r) => [r.itemKey, r]));
    for (const item of items) {
      const topic = item.topic || 'General';
      const resp = respByKey.get(item.key);
      const cur = topicStats.get(topic) ?? { earned: 0, possible: 0, count: 0 };
      cur.possible += item.points;
      cur.earned += resp?.score ?? 0;
      cur.count += 1;
      topicStats.set(topic, cur);
    }
  }

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/teach', label: 'Dashboard' },
        { href: '/teach/sections', label: 'Sections' },
        { href: '/teach/questions', label: 'Question bank' },
        { href: '/teach/sets', label: 'Question sets' },
        { href: '/teach/assessments', label: 'Assessments' },
        { href: '/teach/invites', label: 'Invites' },
        { href: '/teach/grading', label: 'Grading' },
      ]}
    >
      <PageHeader
        title={learner.name ?? learner.email}
        subtitle={`${learner.email} · ${section.name}${enrollment ? '' : ' · not currently enrolled'}`}
        actions={<Link href={`/teach/sections/${id}`} className="text-sm text-pine-900 hover:underline">← Section</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="font-semibold text-ink-900">Completion</h2>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {completionRate == null ? '—' : `${completionRate}%`}
          </p>
          <p className="text-sm text-ink-600">
            {submittedCount} of {available.length} available assignments submitted
          </p>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink-900">Performance by topic</h2>
          {topicStats.size === 0 ? (
            <p className="text-sm text-ink-600">No graded work yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...topicStats.entries()].map(([topic, s]) => (
                <li key={topic} className="flex items-center justify-between rounded-lg border border-ink-400/15 px-4 py-2 text-sm">
                  <span className="font-medium text-ink-900">{topic}</span>
                  <span className="text-ink-600">
                    {s.earned}/{s.possible} pts · {Math.round((s.earned / s.possible) * 100)}% · {s.count} items
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-6 text-lg font-semibold text-ink-900">Assignments</h2>
      {rows.length === 0 ? (
        <EmptyState title="No published assignments" />
      ) : (
        <Table head={['Assessment', 'Mode', 'Status', 'Attempts', 'Latest score', 'Submitted']}>
          {rows.map(({ asg, status, tone, attempts: atts }) => {
            const graded = atts.filter((a) => a.status === 'SUBMITTED' && a.gradingStatus !== 'PENDING_GRADING');
            const latest = graded[graded.length - 1];
            return (
              <tr key={asg.id}>
                <td className="px-4 py-3 font-medium text-ink-900">{asg.assessment.title}</td>
                <td className="px-4 py-3"><Badge tone="neutral">{asg.assessment.mode}</Badge></td>
                <td className="px-4 py-3"><Badge tone={tone}>{status}</Badge></td>
                <td className="px-4 py-3 text-ink-600">
                  {atts.length === 0 ? '—' : atts.map((a) => `#${a.attemptNumber}`).join(', ')}
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {latest?.score != null ? `${latest.score}/${latest.maxScore}` : '—'}
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {latest?.submittedAt ? formatDateTime(latest.submittedAt, user.timezone) : '—'}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <h2 className="mb-3 mt-6 text-lg font-semibold text-ink-900">Attempt history</h2>
      {attempts.length === 0 ? (
        <EmptyState title="No attempts yet" />
      ) : (
        <Table head={['Assessment', 'Attempt', 'Status', 'Score', 'Grading', 'Started', 'Submitted']}>
          {attempts.map((a) => {
            const asg = assignments.find((x) => x.id === a.assignmentId);
            return (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium text-ink-900">{asg?.assessment.title ?? '—'}</td>
                <td className="px-4 py-3 text-ink-600">#{a.attemptNumber}</td>
                <td className="px-4 py-3"><Badge tone={a.status === 'SUBMITTED' ? 'green' : 'blue'}>{a.status === 'SUBMITTED' ? 'Submitted' : 'In progress'}</Badge></td>
                <td className="px-4 py-3 text-ink-600">{a.score != null ? `${a.score}/${a.maxScore}` : '—'}</td>
                <td className="px-4 py-3 text-ink-600">{a.gradingStatus ?? '—'}</td>
                <td className="px-4 py-3 text-ink-600">{formatDateTime(a.startedAt, user.timezone)}</td>
                <td className="px-4 py-3 text-ink-600">{a.submittedAt ? formatDateTime(a.submittedAt, user.timezone) : '—'}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </AppShell>
  );
}
