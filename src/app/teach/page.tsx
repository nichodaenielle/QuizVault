import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { instructorSectionIds } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, EmptyState, LinkButton, PageHeader } from '@/components/ui';
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

  // Grading queue: essay responses awaiting manual grades in accessible scope.
  const pendingEssays = await prisma.response.count({
    where: {
      grade: { is: null },
      score: null,
      attempt: {
        status: 'SUBMITTED',
        OR:
          user.role === 'ADMIN'
            ? [{}]
            : [
                { assignment: { sectionId: { in: sectionIds ?? [] } } },
                { assessment: { ownerId: user.id } },
              ],
      },
    },
  });

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/teach', label: 'Dashboard' },
        { href: '/teach/sections', label: 'Sections' },
        { href: '/teach/questions', label: 'Question bank' },
        { href: '/teach/sets', label: 'Question sets' },
        { href: '/teach/assessments', label: 'Assessments' },
        { href: '/teach/grading', label: `Grading${pendingEssays ? ` (${pendingEssays})` : ''}` },
      ]}
    >
      <PageHeader
        title="Instructor dashboard"
        subtitle="Sections, assessments, and grading."
        actions={<LinkButton href="/teach/assessments/new" variant="secondary">New assessment</LinkButton>}
      />

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
