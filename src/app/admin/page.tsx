import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import type { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ROLE_TONE: Record<Role, 'neutral' | 'green' | 'gold'> = {
  LEARNER: 'neutral',
  INSTRUCTOR: 'green',
  ADMIN: 'gold',
};

function humanize(action: string) {
  return action.toLowerCase().replace(/_/g, ' ');
}

export default async function AdminPage() {
  const user = await requireRole('ADMIN');
  const [users, sections, assessments, attempts, enrollments, roleCounts, recentUsers, activity] =
    await Promise.all([
      prisma.user.count(),
      prisma.section.count(),
      prisma.assessment.count(),
      prisma.attempt.count(),
      prisma.enrollment.count(),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);

  const roleCount = (r: Role) => roleCounts.find((x) => x.role === r)?._count ?? 0;

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
      <PageHeader title="Admin overview" subtitle="Platform-wide records and access." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Users', value: users, href: '/admin/users' },
          { label: 'Sections', value: sections, href: '/admin/sections' },
          { label: 'Enrollments', value: enrollments, href: '/admin/sections' },
          { label: 'Assessments', value: assessments, href: '/teach/assessments' },
          { label: 'Attempts', value: attempts, href: '/teach' },
        ].map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} href={s.href} />
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-ink-900">Users by role</h2>
          <ul className="space-y-2">
            {(['LEARNER', 'INSTRUCTOR', 'ADMIN'] as Role[]).map((r) => (
              <li key={r} className="flex items-center justify-between">
                <Badge tone={ROLE_TONE[r]}>{r}</Badge>
                <span className="text-sm font-semibold tabular-nums text-ink-900">{roleCount(r)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Recent signups</h2>
            <Link href="/admin/users" className="text-xs text-pine-900 hover:underline">All users</Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-ink-600">No users yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">{u.name ?? u.email}</span>
                    {u.name && <span className="block truncate text-xs text-ink-600">{u.email}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge>
                    <span className="text-xs text-ink-600">{formatDateTime(u.createdAt, user.timezone)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-ink-900">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-ink-600">No recorded activity yet.</p>
          ) : (
            <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {activity.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium text-ink-900">{humanize(a.action)}</span>
                  <span className="text-ink-600"> · {a.entity.toLowerCase()}</span>
                  <span className="block text-xs text-ink-600">
                    {a.actor ? (a.actor.name ?? a.actor.email) : 'System'} · {formatDateTime(a.createdAt, user.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <LinkButton href="/admin/users" variant="secondary">Manage users & roles</LinkButton>
      </div>
    </AppShell>
  );
}
