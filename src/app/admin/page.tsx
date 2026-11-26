import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Card, LinkButton, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireRole('ADMIN');
  const [users, sections, assessments, attempts, enrollments] = await Promise.all([
    prisma.user.count(),
    prisma.section.count(),
    prisma.assessment.count(),
    prisma.attempt.count(),
    prisma.enrollment.count(),
  ]);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Users', value: users, href: '/admin/users' },
          { label: 'Sections', value: sections, href: '/admin/sections' },
          { label: 'Enrollments', value: enrollments, href: '/admin/sections' },
          { label: 'Assessments', value: assessments, href: '/teach/assessments' },
          { label: 'Attempts', value: attempts, href: '/teach' },
        ].map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-4 transition-colors hover:border-pine-800/40">
              <p className="text-2xl font-semibold text-ink-900">{s.value}</p>
              <p className="text-sm text-ink-600">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <LinkButton href="/admin/users" variant="secondary">Manage users & roles</LinkButton>
      </div>
    </AppShell>
  );
}
