import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { CreateSetForm } from './new/form';
import { SetRowActions } from './row-actions';

export const dynamic = 'force-dynamic';

export default async function SetsPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const sets = await prisma.questionSet.findMany({
    where: {
      ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}),
      archived: false,
    },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: 'desc' },
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
      <PageHeader title="Question sets" subtitle="Reusable groups of questions for assessments." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sets.length === 0 ? (
            <EmptyState title="No sets yet" body="Create a set, then add questions to it." />
          ) : (
            <Table head={['Title', 'Questions', 'Updated', 'Actions']}>
              {sets.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/teach/sets/${s.id}`} className="font-medium text-ink-900 hover:underline">
                      {s.title}
                    </Link>
                    {s.description && <p className="text-xs text-ink-600">{s.description}</p>}
                  </td>
                  <td className="px-4 py-3"><Badge tone="neutral">{s._count.items}</Badge></td>
                  <td className="px-4 py-3 text-ink-600">{s.updatedAt.toLocaleDateString()}</td>
                  <td className="px-4 py-3"><SetRowActions id={s.id} /></td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-3 font-semibold text-ink-900">New set</h2>
          <CreateSetForm />
        </Card>
      </div>
    </AppShell>
  );
}
