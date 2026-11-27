import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { CreateSetForm } from './new/form';
import { SetRowActions } from './row-actions';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function SetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const sp = await searchParams;
  const archivedFilter = sp.archived === '1' ? true : sp.archived === 'all' ? undefined : false;
  const sets = await prisma.questionSet.findMany({
    where: {
      ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}),
      ...(archivedFilter !== undefined ? { archived: archivedFilter } : {}),
    },
    include: {
      _count: { select: { items: true } },
      owner: { select: { name: true, email: true } },
    },
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
        { href: '/teach/invites', label: 'Invites' },
        { href: '/teach/grading', label: 'Grading' },
      ]}
    >
      <PageHeader title="Question sets" subtitle="Reusable groups of questions for assessments." />
      <div className="mb-4 flex gap-2 text-sm">
        {[
          { v: '', label: 'Active' },
          { v: '1', label: 'Archived' },
          { v: 'all', label: 'All' },
        ].map((f) => (
          <Link
            key={f.v}
            href={f.v ? `/teach/sets?archived=${f.v}` : '/teach/sets'}
            className={`rounded-lg border px-3 py-1.5 ${
              (sp.archived ?? '') === f.v
                ? 'border-pine-900 bg-pine-900 text-ivory-50'
                : 'border-ink-400/30 text-ink-600 hover:bg-pine-50'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sets.length === 0 ? (
            <EmptyState title="No sets yet" body="Create a set, then add questions to it." />
          ) : (
            <Table head={['Title', 'Questions', 'Author', 'Updated', 'Actions']}>
              {sets.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/teach/sets/${s.id}`} className="font-medium text-ink-900 hover:underline">
                      {s.title}
                    </Link>
                    {s.description && <p className="text-xs text-ink-600">{s.description}</p>}
                  </td>
                  <td className="px-4 py-3"><Badge tone="neutral">{s._count.items}</Badge></td>
                  <td className="px-4 py-3 text-ink-600">{s.owner.name ?? s.owner.email}</td>
                  <td className="px-4 py-3 text-ink-600">{formatDateTime(s.updatedAt, user.timezone)}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      {s.archived && <Badge tone="gold">Archived</Badge>}
                      <SetRowActions id={s.id} archived={s.archived} />
                    </span>
                  </td>
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
