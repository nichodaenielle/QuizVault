import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { QuestionForm } from '../question-form';
import type { QuestionPayload } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const { id } = await params;
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) notFound();
  if (user.role === 'INSTRUCTOR' && q.ownerId !== user.id) notFound();

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
        title={q.archived ? 'View question' : 'Edit question'}
        subtitle={`Version ${q.version} · edits never change already-published attempts`}
      />
      <div className="max-w-3xl">
        <QuestionForm
          initial={{
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty,
            points: q.points,
            payload: q.payload as unknown as QuestionPayload,
            explanation: q.explanation,
            archived: q.archived,
          }}
        />
      </div>
    </AppShell>
  );
}
