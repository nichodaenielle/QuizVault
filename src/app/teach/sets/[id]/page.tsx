import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Card, EmptyState, PageHeader } from '@/components/ui';
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
      <PageHeader title={set.title} subtitle={set.description ?? `${set.items.length} questions`} actions={<Link href="/teach/sets" className="text-sm text-pine-900 hover:underline">← All sets</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink-900">Questions (drag to reorder)</h2>
            {set.items.length === 0 ? (
              <EmptyState title="Empty set" body="Add questions from your bank." />
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
            <SetMetaForm setId={set.id} title={set.title} description={set.description ?? ''} />
          </Card>
        </div>
      </div>
      <Card className="mt-6 p-5">
        <AddQuestionPicker setId={set.id} candidates={candidates as { id: string; prompt: string; type: QuestionType; subject: string; topic: string; points: number }[]} />
      </Card>
    </AppShell>
  );
}
