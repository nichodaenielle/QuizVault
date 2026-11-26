import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, PageHeader, Table } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { RoleSelect } from './role-select';

export const dynamic = 'force-dynamic';

const ROLE_TONE: Record<string, 'neutral' | 'green' | 'gold'> = {
  LEARNER: 'neutral',
  INSTRUCTOR: 'green',
  ADMIN: 'gold',
};

export default async function AdminUsersPage() {
  const user = await requireRole('ADMIN');
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { enrollments: true, attempts: true } } },
  });

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/users', label: 'Users & roles' },
        { href: '/admin/sections', label: 'Sections' },
        { href: '/admin/invites', label: 'Invites' },
      ]}
    >
      <PageHeader title="Users & roles" subtitle="Role changes are audited." />
      <Table head={['Name', 'Email', 'Role', 'Sections', 'Attempts', 'Joined', 'Change role']}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3 font-medium text-ink-900">{u.name ?? '—'}</td>
            <td className="px-4 py-3 text-ink-600">{u.email}</td>
            <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
            <td className="px-4 py-3 text-ink-600">{u._count.enrollments}</td>
            <td className="px-4 py-3 text-ink-600">{u._count.attempts}</td>
            <td className="px-4 py-3 text-ink-600">{formatDateTime(u.createdAt, user.timezone)}</td>
            <td className="px-4 py-3">
              <RoleSelect userId={u.id} currentRole={u.role} isSelf={u.id === user.id} />
            </td>
          </tr>
        ))}
      </Table>
    </AppShell>
  );
}
