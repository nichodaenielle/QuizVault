import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, PageHeader, Table } from '@/components/ui';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminSectionsPage() {
  const user = await requireRole('ADMIN');
  const sections = await prisma.section.findMany({
    include: {
      _count: { select: { enrollments: true, assignments: true } },
      instructors: { include: { user: { select: { name: true } } } },
      codes: { where: { status: 'ACTIVE' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/users', label: 'Users & roles' },
        { href: '/admin/sections', label: 'Sections' },
        { href: '/teach', label: 'Instructor view' },
      ]}
    >
      <PageHeader title="Sections" subtitle="All sections across the platform." />
      <Table head={['Name', 'Code', 'Instructors', 'Learners', 'Assignments', 'Created']}>
        {sections.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-3">
              <Link href={`/teach/sections/${s.id}`} className="font-medium text-ink-900 hover:underline">
                {s.name}
              </Link>
            </td>
            <td className="px-4 py-3 font-mono text-pine-900">{s.codes[0]?.code ?? '—'}</td>
            <td className="px-4 py-3 text-ink-600">{s.instructors.map((i) => i.user.name).filter(Boolean).join(', ') || '—'}</td>
            <td className="px-4 py-3"><Badge tone="neutral">{s._count.enrollments}</Badge></td>
            <td className="px-4 py-3 text-ink-600">{s._count.assignments}</td>
            <td className="px-4 py-3 text-ink-600">{formatDateTime(s.createdAt, user.timezone)}</td>
          </tr>
        ))}
      </Table>
    </AppShell>
  );
}
