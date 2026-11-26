import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { instructorSectionIds } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { CreateSectionForm } from './new/form';
import { listInstructors } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function SectionsPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const sectionIds = user.role === 'ADMIN' ? null : await instructorSectionIds(user.id);
  const sections = await prisma.section.findMany({
    where: sectionIds ? { id: { in: sectionIds } } : {},
    include: {
      _count: { select: { enrollments: true } },
      codes: { where: { status: 'ACTIVE' }, take: 1 },
      instructors: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const instructors = user.role === 'ADMIN' ? await listInstructors() : [];

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
      <PageHeader title="Sections" subtitle="Course sections and class codes." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sections.length === 0 ? (
            <EmptyState title="No sections" body="Create your first section to get a join code." />
          ) : (
            <ul className="space-y-3">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/teach/sections/${s.id}`}
                    className="block rounded-xl border border-ink-400/15 bg-ivory-100 p-4 transition-colors hover:border-pine-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{s.name}</p>
                      <Badge tone="neutral">{s._count.enrollments} learners</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      Code: <span className="font-mono font-semibold text-pine-900">{s.codes[0]?.code ?? '—'}</span>
                      {' · '}
                      {s.instructors.map((i) => i.user.name).filter(Boolean).join(', ') || 'No instructor'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-3 font-semibold text-ink-900">New section</h2>
          <CreateSectionForm instructors={instructors} isAdmin={user.role === 'ADMIN'} />
        </Card>
      </div>
    </AppShell>
  );
}
