import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { instructorSectionIds } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function TeachPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const sectionIds = user.role === 'ADMIN' ? null : await instructorSectionIds(user.id);

  const sections = await prisma.section.findMany({
    where: sectionIds ? { id: { in: sectionIds } } : {},
    include: {
      _count: { select: { enrollments: true } },
      instructors: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const myAssessments = await prisma.assessment.findMany({
    where: user.role === 'ADMIN' ? {} : { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: { _count: { select: { attempts: true } } },
  });

  const scopeOr =
    user.role === 'ADMIN'
      ? [{}]
      : [
          { assignment: { sectionId: { in: sectionIds ?? [] } } },
          { assessment: { ownerId: user.id } },
        ];

  // Grading queue: essay responses awaiting manual grades in accessible scope.
  const pendingEssays = await prisma.response.count({
    where: {
      grade: { is: null },
      score: null,
      attempt: { status: 'SUBMITTED', OR: scopeOr },
    },
  });

  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);
  const [assessmentStats, closingSoon, overdueAttempts] = await Promise.all([
    prisma.assessment.groupBy({
      by: ['status'],
      where: user.role === 'ADMIN' ? {} : { ownerId: user.id },
      _count: true,
    }),
    prisma.sectionAssignment.findMany({
      where: {
        assessment: { status: 'PUBLISHED' },
        closesAt: { gt: now, lte: soon },
        OR: user.role === 'ADMIN' ? undefined : [
          { sectionId: { in: sectionIds ?? [] } },
          { assessment: { ownerId: user.id } },
        ],
      },
      include: {
        assessment: { select: { title: true } },
        section: { select: { name: true } },
      },
      orderBy: { closesAt: 'asc' },
      take: 5,
    }),
    prisma.attempt.count({
      where: {
        status: 'IN_PROGRESS',
        deadlineAt: { lt: now },
        OR: scopeOr,
      },
    }),
  ]);
  const publishedCount = assessmentStats.find((s) => s.status === 'PUBLISHED')?._count ?? 0;
  const totalAssessments = assessmentStats.reduce((n, s) => n + s._count, 0);
  const learnerCount = sections.reduce((n, s) => n + s._count.enrollments, 0);

  const attention: { label: string; count: number; href: string; tone: 'red' | 'gold' | 'blue' }[] = [];
  if (pendingEssays > 0) attention.push({ label: 'essays awaiting grading', count: pendingEssays, href: '/teach/grading', tone: 'gold' });
  if (closingSoon.length > 0) attention.push({ label: 'closing within 48h', count: closingSoon.length, href: '#closing-soon', tone: 'blue' });
  if (overdueAttempts > 0) attention.push({ label: 'expired attempts pending finalize', count: overdueAttempts, href: '#attention', tone: 'red' });

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
        { href: '/teach/grading', label: `Grading${pendingEssays ? ` (${pendingEssays})` : ''}` },
      ]}
    >
      <PageHeader
        title="Instructor dashboard"
        subtitle="Sections, assessments, and grading."
        actions={<LinkButton href="/teach/assessments/new" variant="secondary">New assessment</LinkButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="My sections" value={sections.length} href="/teach/sections" />
        <StatCard label="Learners" value={learnerCount} hint="enrolled across your sections" />
        <StatCard label="Assessments" value={totalAssessments} hint={`${publishedCount} published`} href="/teach/assessments" />
        <StatCard
          label="Pending grades"
          value={pendingEssays}
          hint={pendingEssays ? 'essays in the queue' : 'queue is clear'}
          tone={pendingEssays ? 'gold' : 'green'}
          href="/teach/grading"
        />
      </div>

      {(attention.length > 0 || closingSoon.length > 0) && (
        <Card id="attention" className="mb-6 border-gold-500/40 bg-gold-100/40 p-5">
          <h2 className="font-semibold text-ink-900">Needs attention</h2>
          {attention.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {attention.map((a) => (
                <li key={a.label} className="flex items-center gap-2 text-sm">
                  <Badge tone={a.tone}>{a.count}</Badge>
                  <span className="text-ink-900">{a.label}</span>
                </li>
              ))}
            </ul>
          )}
          {closingSoon.length > 0 && (
            <div id="closing-soon" className="mt-3 border-t border-gold-500/30 pt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-600">Closing within 48 hours</p>
              <ul className="space-y-1 text-sm">
                {closingSoon.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-ink-900">
                      {a.assessment.title} <span className="text-ink-600">· {a.section.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink-600">
                      {formatDateTime(a.closesAt, user.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3">
            <LinkButton href="/teach/grading" variant="secondary">Open grading queue</LinkButton>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="my-sections">
          <h2 id="my-sections" className="mb-3 text-lg font-semibold text-ink-900">My sections</h2>
          {sections.length === 0 ? (
            <EmptyState title="No sections yet" body="Create a section to get a class code." action={<LinkButton href="/teach/sections" variant="secondary">Go to sections</LinkButton>} />
          ) : (
            <ul className="space-y-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link href={`/teach/sections/${s.id}`} className="block rounded-xl border border-ink-400/15 bg-ivory-100 p-4 hover:border-pine-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{s.name}</p>
                      <Badge tone="neutral">{s._count.enrollments} learners</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {s.instructors.map((i) => i.user.name).filter(Boolean).join(', ') || 'No instructor'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-assessments">
          <h2 id="recent-assessments" className="mb-3 text-lg font-semibold text-ink-900">Recent assessments</h2>
          {myAssessments.length === 0 ? (
            <EmptyState title="No assessments yet" body="Build a reviewer, quiz, or exam." action={<LinkButton href="/teach/assessments/new" variant="secondary">New assessment</LinkButton>} />
          ) : (
            <ul className="space-y-2">
              {myAssessments.map((a) => (
                <li key={a.id}>
                  <Link href={`/teach/assessments/${a.id}`} className="block rounded-xl border border-ink-400/15 bg-ivory-100 p-4 hover:border-pine-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{a.title}</p>
                      <Badge tone={a.status === 'PUBLISHED' ? 'green' : a.status === 'CLOSED' ? 'red' : 'neutral'}>{a.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {a.mode} · {a._count.attempts} attempts · updated {formatDateTime(a.updatedAt, user.timezone)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
