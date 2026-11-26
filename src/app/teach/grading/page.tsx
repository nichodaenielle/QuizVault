import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { instructorSectionIds } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, EmptyState, PageHeader, Table } from '@/components/ui';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function GradingPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const sectionIds = user.role === 'ADMIN' ? null : await instructorSectionIds(user.id);

  const responses = await prisma.response.findMany({
    where: {
      grade: { is: null },
      score: null,
      maxScore: { not: null },
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
    include: {
      attempt: {
        include: {
          assessment: { select: { title: true } },
          assignment: { include: { section: { select: { name: true } } } },
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { savedAt: 'asc' },
    take: 200,
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
        { href: '/teach/invites', label: 'Invites' },
        { href: '/teach/grading', label: 'Grading' },
      ]}
    >
      <PageHeader title="Grading queue" subtitle="Essay responses awaiting manual grading." />
      {responses.length === 0 ? (
        <EmptyState title="All caught up" body="No essays are waiting for grades." />
      ) : (
        <Table head={['Assessment', 'Learner', 'Section', 'Max points', 'Submitted', '']}>
          {responses.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-ink-900">{r.attempt.assessment.title}</td>
              <td className="px-4 py-3 text-ink-600">{r.attempt.user.name ?? r.attempt.user.email}</td>
              <td className="px-4 py-3 text-ink-600">{r.attempt.assignment.section.name}</td>
              <td className="px-4 py-3 text-ink-600">{r.maxScore}</td>
              <td className="px-4 py-3 text-ink-600">{r.attempt.submittedAt ? formatDateTime(r.attempt.submittedAt, user.timezone) : '—'}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/teach/grading/${r.id}`} className="text-sm font-medium text-pine-900 hover:underline">
                  Grade
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-ink-600">
        <Badge tone="gold">Pending</Badge> Mixed assessments stay in “pending grading” status until all essays are graded.
      </p>
    </AppShell>
  );
}
