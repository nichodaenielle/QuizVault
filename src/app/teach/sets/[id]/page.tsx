import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { SetItemsEditor, AddQuestionPicker } from './items-editor';
import { SetMetaForm } from './meta-form';
import type { QuestionType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const { id } = await params;
  const set = await prisma.questionSet.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: 'asc' }, include: { question: true } },
      owner: { select: { name: true, email: true } },
    },
  });
  if (!set) notFound();
  if (user.role === 'INSTRUCTOR' && set.ownerId !== user.id) notFound();

  // Questions available to add (not already in set, not archived).
  const inSet = new Set(set.items.map((i) => i.questionId));
  const candidates = await prisma.question.findMany({
    where: {
      archived: false,
      ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}),
      id: { notIn: [...inSet] },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: { id: true, prompt: true, type: true, subject: true, topic: true, points: true },
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
      <PageHeader
        title={set.title}
        subtitle={`${set.description ? `${set.description} · ` : ''}by ${set.owner.name ?? set.owner.email} · ${set.items.length} questions`}
        actions={
          <span className="flex items-center gap-2">
            {set.archived && <Badge tone="gold">Archived</Badge>}
            <Link href="/teach/sets" className="text-sm text-pine-900 hover:underline">← All sets</Link>
          </span>
        }
      />
      {set.archived && (
        <p className="mb-4 rounded-lg border border-gold-500/40 bg-gold-100/60 px-4 py-2 text-sm text-ink-900">
          This set is archived — it&apos;s hidden from assessment pickers and can&apos;t be edited. Restore it from the sets list to make changes.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Questions {set.archived ? '' : '(drag to reorder)'}</h2>
            {set.items.length === 0 ? (
              <EmptyState title="Empty set" body="Add questions from your bank." />
            ) : set.archived ? (
              <ol className="space-y-2">
                {set.items.map((i, idx) => (
                  <li key={i.questionId} className="flex items-start gap-3 rounded-lg border border-ink-400/20 bg-ivory-50 p-3">
                    <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-semibold text-ink-400">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-ink-900">{i.question.prompt}</p>
                      <p className="mt-1 text-xs text-ink-600">{i.question.points} pts · {i.question.topic}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <SetItemsEditor
                setId={set.id}
                items={set.items.map((i) => ({
                  questionId: i.questionId,
                  prompt: i.question.prompt,
                  type: i.question.type,
                  points: i.question.points,
                  topic: i.question.topic,
                }))}
              />
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Details</h2>
            <SetMetaForm setId={set.id} title={set.title} description={set.description ?? ''} disabled={set.archived} />
          </Card>
        </div>
      </div>
      {!set.archived && (
        <Card className="mt-6 p-5">
          <AddQuestionPicker setId={set.id} candidates={candidates as { id: string; prompt: string; type: QuestionType; subject: string; topic: string; points: number }[]} />
        </Card>
      )}
    </AppShell>
  );
}
