import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { instructorSectionIds } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { Badge, Card, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { Studio } from './studio';
import type { DraftSpec } from '@/lib/actions/assessments';
import type { FeedbackRelease } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: 'desc' } },
      assignments: {
        include: {
          section: { select: { id: true, name: true } },
          _count: { select: { attempts: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!assessment) notFound();
  if (user.role === 'INSTRUCTOR' && assessment.ownerId !== user.id) notFound();

  const isAdmin = user.role === 'ADMIN';
  const sectionIds = isAdmin ? null : await instructorSectionIds(user.id);

  const [questions, sets, sections] = await Promise.all([
    prisma.question.findMany({
      where: {
        archived: false,
        ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}),
      },
      orderBy: [{ subject: 'asc' }, { topic: 'asc' }],
      select: { id: true, prompt: true, type: true, points: true, topic: true, subject: true },
      take: 1000,
    }),
    prisma.questionSet.findMany({
      where: { archived: false, ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}) },
      select: { id: true, title: true, _count: { select: { items: true } } },
      orderBy: { title: 'asc' },
    }),
    prisma.section.findMany({
      where: sectionIds ? { id: { in: sectionIds } } : {},
      select: {
        id: true,
        name: true,
        _count: { select: { enrollments: true } },
        instructors: { where: { userId: user.id }, select: { userId: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  // For instructors, only sections they manage.
  const manageableSections = isAdmin
    ? sections
    : sections.filter((s) => s.instructors.length > 0);

  const draft = (assessment.draft ?? { items: [], settings: {} }) as DraftSpec;

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
        title={assessment.title}
        subtitle={`${assessment.mode} · ${assessment.description ?? ''}`}
        actions={
          <span className="flex items-center gap-2">
            <Badge tone={assessment.status === 'PUBLISHED' ? 'green' : assessment.status === 'CLOSED' ? 'red' : 'neutral'}>
              {assessment.status}
            </Badge>
            <Link href="/teach/assessments" className="text-sm text-pine-900 hover:underline">← All</Link>
          </span>
        }
      />

      <Studio
        assessmentId={assessment.id}
        status={assessment.status}
        initialDraft={draft}
        questions={questions}
        sets={sets.map((s) => ({ id: s.id, title: s.title, count: s._count.items }))}
        sections={manageableSections.map((s) => ({
          id: s.id,
          name: s.name,
          learners: s._count.enrollments,
        }))}
        assignments={assessment.assignments.map((a) => ({
          id: a.id,
          sectionId: a.sectionId,
          sectionName: a.section.name,
          opensAt: a.opensAt?.toISOString() ?? null,
          closesAt: a.closesAt?.toISOString() ?? null,
          timeLimitSec: a.timeLimitSec,
          attemptLimit: a.attemptLimit,
          shuffleQuestions: a.shuffleQuestions,
          shuffleOptions: a.shuffleOptions,
          feedbackRelease: (a.feedbackRelease as FeedbackRelease | null) ?? null,
          attemptCount: a._count.attempts,
        }))}
        versions={assessment.versions.map((v) => ({
          version: v.version,
          publishedAt: v.publishedAt.toISOString(),
        }))}
        timezone={user.timezone}
      />

      {assessment.versions.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-semibold text-ink-900">Published versions</h2>
          <ul className="space-y-1 text-sm text-ink-600">
            {assessment.versions.map((v) => (
              <li key={v.id}>
                v{v.version} — {formatDateTime(v.publishedAt, user.timezone)} · immutable snapshot
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-600">
            Editing questions or this draft never changes questions or grading rules in existing attempts.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
