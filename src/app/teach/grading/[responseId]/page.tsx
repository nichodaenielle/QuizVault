import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { canManageSection } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, Card, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { GradeForm } from './grade-form';
import type { SnapshotItem } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default async function GradeResponsePage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const { responseId } = await params;

  const resp = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      grade: true,
      attempt: {
        include: {
          assessment: { select: { title: true, mode: true, ownerId: true } },
          assignment: { include: { section: { select: { id: true, name: true } } } },
          user: { select: { name: true, email: true } },
          version: true,
        },
      },
    },
  });
  if (!resp) notFound();

  const allowed =
    user.role === 'ADMIN' ||
    resp.attempt.assessment.ownerId === user.id ||
    (await canManageSection(user, resp.attempt.assignment.sectionId));
  if (!allowed) notFound();

  const items = (resp.attempt.items as unknown as SnapshotItem[] | null) ?? [];
  const item = items.find((i) => i.key === resp.itemKey);
  const rubric = (item?.payload as { rubric?: { label: string; maxPoints: number; description?: string }[] } | undefined)?.rubric;

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
        title="Grade essay"
        subtitle={`${resp.attempt.assessment.title} · ${resp.attempt.user.name ?? resp.attempt.user.email} · ${resp.attempt.assignment.section.name}`}
        actions={<Link href="/teach/grading" className="text-sm text-pine-900 hover:underline">← Queue</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone="neutral">{item?.type.replace(/_/g, ' ') ?? 'ESSAY'}</Badge>
              <Badge tone="green">{resp.maxScore} pts max</Badge>
            </div>
            <h2 className="text-lg font-medium text-ink-900">{item?.prompt ?? 'Question'}</h2>
            {rubric && rubric.length > 0 && (
              <div className="mt-3 rounded-lg border border-gold-500/40 bg-gold-100/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Rubric</p>
                <ul className="mt-1 space-y-1 text-sm text-ink-900">
                  {rubric.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium">{c.label}</span> — up to {c.maxPoints} pts
                      {c.description && <span className="text-ink-600"> ({c.description})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">Learner answer</p>
            <p className="whitespace-pre-wrap text-sm text-ink-900">
              {typeof resp.answer === 'string' ? resp.answer : 'No answer submitted.'}
            </p>
            <p className="mt-3 text-xs text-ink-400">Submitted {formatDateTime(resp.attempt.submittedAt, user.timezone)}</p>
          </Card>
        </div>
        <Card className="h-fit p-5">
          <GradeForm
            responseId={resp.id}
            maxScore={resp.maxScore ?? item?.points ?? 0}
            existing={
              resp.grade
                ? {
                    score: resp.grade.score,
                    feedback: resp.grade.feedback ?? '',
                    rubricScores: resp.grade.rubricScores,
                  }
                : null
            }
            rubric={rubric}
          />
        </Card>
      </div>
    </AppShell>
  );
}
