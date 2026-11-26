import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { canManageSection, listInstructors } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { CodeControls } from './code-controls';
import { RosterControls } from './roster-controls';
import { InstructorControls } from './instructor-controls';
import { InviteLearner } from './invite-learner';

export const dynamic = 'force-dynamic';

export default async function SectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const { id } = await params;

  if (!(await canManageSection(user, id))) notFound();

  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      instructors: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      codes: { orderBy: { createdAt: 'desc' } },
      enrollments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
      assignments: {
        include: { assessment: { select: { title: true, mode: true, status: true } } },
      },
    },
  });
  if (!section) notFound();

  // Per-learner progress summary.
  const learnerIds = section.enrollments.map((e) => e.userId);
  const progress = await prisma.attempt.groupBy({
    by: ['userId', 'status'],
    where: { userId: { in: learnerIds } },
    _count: true,
  });
  const progMap = new Map<string, { inProgress: number; submitted: number }>();
  for (const p of progress) {
    const cur = progMap.get(p.userId) ?? { inProgress: 0, submitted: 0 };
    if (p.status === 'IN_PROGRESS') cur.inProgress += p._count;
    else cur.submitted += p._count;
    progMap.set(p.userId, cur);
  }

  const instructors = user.role === 'ADMIN' ? await listInstructors() : [];
  const activeCode = section.codes.find((c) => c.status === 'ACTIVE');

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
      <PageHeader
        title={section.name}
        subtitle={section.description ?? undefined}
        actions={<Link href="/teach/sections" className="text-sm text-pine-900 hover:underline">← All sections</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Roster ({section.enrollments.length})</h2>
            {section.enrollments.length === 0 ? (
              <EmptyState title="No learners yet" body="Share the class code so learners can join." />
            ) : (
              <Table head={['Learner', 'Email', 'Attempts', '']}>
                {section.enrollments.map((e) => {
                  const p = progMap.get(e.userId) ?? { inProgress: 0, submitted: 0 };
                  return (
                    <tr key={e.id}>
                      <td className="px-4 py-3 font-medium text-ink-900">{e.user.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{e.user.email}</td>
                      <td className="px-4 py-3 text-ink-600">
                        {p.inProgress} in progress · {p.submitted} submitted
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex justify-end gap-2">
                          <Link
                            href={`/teach/sections/${id}/learners/${e.userId}`}
                            className="text-sm font-medium text-pine-900 hover:underline"
                          >
                            Progress
                          </Link>
                          <RosterControls sectionId={id} userId={e.userId} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Published assignments</h2>
            {section.assignments.length === 0 ? (
              <p className="text-sm text-ink-600">No assignments yet. Publish an assessment to this section.</p>
            ) : (
              <ul className="space-y-2">
                {section.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg border border-ink-400/15 px-4 py-3">
                    <div>
                      <Link href={`/teach/assessments/${a.assessmentId}`} className="font-medium text-ink-900 hover:underline">
                        {a.assessment.title}
                      </Link>
                      <p className="text-sm text-ink-600">
                        {a.assessment.mode} · {a.assessment.status}
                        {a.closesAt ? ` · closes ${formatDateTime(a.closesAt, user.timezone)}` : ''}
                      </p>
                    </div>
                    <Badge tone={a.assessment.status === 'PUBLISHED' ? 'green' : 'neutral'}>{a.assessment.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Class code</h2>
            {activeCode ? (
              <div className="rounded-lg bg-pine-900 p-4 text-center">
                <p className="font-mono text-2xl font-bold tracking-[0.3em] text-gold-500">{activeCode.code}</p>
                <p className="mt-1 text-xs text-ivory-50/70">
                  {activeCode.expiresAt ? `Expires ${formatDateTime(activeCode.expiresAt, user.timezone)}` : 'No expiry'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-600">No active code. Rotate to generate one.</p>
            )}
            <div className="mt-3">
              <CodeControls sectionId={id} codes={section.codes.map((c) => ({ id: c.id, code: c.code, status: c.status, expiresAt: c.expiresAt?.toISOString() ?? null }))} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Invite by link</h2>
            <InviteLearner sectionId={id} sectionName={section.name} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Instructors</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {section.instructors.map((i) => (
                <li key={i.userId} className="flex items-center justify-between">
                  <span className="text-ink-900">{i.user.name ?? i.user.email}</span>
                  <InstructorControls sectionId={id} userId={i.userId} canRemove={!(user.role === 'INSTRUCTOR' && i.userId !== user.id)} />
                </li>
              ))}
            </ul>
            {user.role === 'ADMIN' && (
              <InstructorControls sectionId={id} instructors={instructors.filter((i) => !section.instructors.some((si) => si.userId === i.id))} mode="assign" />
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
