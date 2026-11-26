import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, EmptyState, LinkButton, PageHeader, Table } from '@/components/ui';
import { AssessmentRowActions } from './row-actions';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'green' | 'red' | 'gold'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'green',
  CLOSED: 'red',
  ARCHIVED: 'gold',
};

export default async function AssessmentsPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const assessments = await prisma.assessment.findMany({
    where: user.role === 'ADMIN' ? {} : { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { attempts: true, assignments: true } },
      versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
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
        { href: '/teach/grading', label: 'Grading' },
      ]}
    >
      <PageHeader
        title="Assessments"
        subtitle="Reviewers, quizzes, and exams."
        actions={<LinkButton href="/teach/assessments/new">New assessment</LinkButton>}
      />
      {assessments.length === 0 ? (
        <EmptyState title="No assessments" body="Create a reviewer, quiz, or exam to get started." />
      ) : (
        <Table head={['Title', 'Mode', 'Status', 'Version', 'Sections', 'Attempts', 'Updated', 'Actions']}>
          {assessments.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3">
                <Link href={`/teach/assessments/${a.id}`} className="font-medium text-ink-900 hover:underline">
                  {a.title}
                </Link>
                {a.description && <p className="line-clamp-1 text-xs text-ink-600">{a.description}</p>}
              </td>
              <td className="px-4 py-3"><Badge tone="neutral">{a.mode}</Badge></td>
              <td className="px-4 py-3"><Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge></td>
              <td className="px-4 py-3 text-ink-600">{a.versions[0]?.version ?? '—'}</td>
              <td className="px-4 py-3 text-ink-600">{a._count.assignments}</td>
              <td className="px-4 py-3 text-ink-600">{a._count.attempts}</td>
              <td className="px-4 py-3 text-ink-600">{formatDateTime(a.updatedAt, user.timezone)}</td>
              <td className="px-4 py-3"><AssessmentRowActions id={a.id} status={a.status} /></td>
            </tr>
          ))}
        </Table>
      )}
    </AppShell>
  );
}
