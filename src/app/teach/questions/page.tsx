import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table } from '@/components/ui';
import { QuestionRowActions } from './row-actions';
import { QuestionFilters } from './filters';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  TRUE_FALSE: 'True/False',
  MULTIPLE_CHOICE: 'Multiple choice',
  MULTIPLE_SELECT: 'Multiple select',
  SHORT_ANSWER: 'Short answer',
  IDENTIFICATION: 'Identification',
  ESSAY: 'Essay',
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const sp = await searchParams;

  const where: Prisma.QuestionWhereInput = {
    ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}),
    ...(sp.archived === '1' ? { archived: true } : sp.archived !== 'all' ? { archived: false } : {}),
    ...(sp.type ? { type: sp.type as Prisma.QuestionWhereInput['type'] } : {}),
    ...(sp.difficulty ? { difficulty: sp.difficulty as Prisma.QuestionWhereInput['difficulty'] } : {}),
    ...(sp.subject ? { subject: sp.subject } : {}),
    ...(sp.q ? { OR: [{ prompt: { contains: sp.q, mode: 'insensitive' } }, { topic: { contains: sp.q, mode: 'insensitive' } }] } : {}),
  };

  const [questions, subjects] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { owner: { select: { name: true, email: true } } },
    }),
    prisma.question.findMany({
      where: user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {},
      select: { subject: true },
      distinct: ['subject'],
    }),
  ]);

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
        title="Question bank"
        subtitle="Reusable questions across reviewers, quizzes, and exams."
        actions={<LinkButton href="/teach/questions/new">New question</LinkButton>}
      />
      <Card className="mb-4 p-4">
        <QuestionFilters subjects={subjects.map((s) => s.subject)} current={sp} />
      </Card>
      {questions.length === 0 ? (
        <EmptyState title="No questions found" body="Adjust filters or create a question." />
      ) : (
        <Table head={['Prompt', 'Type', 'Subject / Topic', 'Difficulty', 'Pts', 'Author', 'Status', 'Actions']}>
          {questions.map((q) => (
            <tr key={q.id} className={q.archived ? 'opacity-60' : ''}>
              <td className="max-w-md px-4 py-3">
                <p className="line-clamp-2 text-ink-900">{q.prompt}</p>
              </td>
              <td className="px-4 py-3"><Badge tone="neutral">{TYPE_LABEL[q.type]}</Badge></td>
              <td className="px-4 py-3 text-ink-600">{q.subject} · {q.topic}</td>
              <td className="px-4 py-3 text-ink-600">{q.difficulty}</td>
              <td className="px-4 py-3 text-ink-600">{q.points}</td>
              <td className="px-4 py-3 text-ink-600">{q.owner.name ?? q.owner.email}</td>
              <td className="px-4 py-3">
                {q.archived ? <Badge tone="red">Archived</Badge> : <Badge tone="green">Active</Badge>}
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <Link href={`/teach/questions/${q.id}`} className="text-sm font-medium text-pine-900 hover:underline">
                    {q.archived ? 'View' : 'Edit'}
                  </Link>
                  <QuestionRowActions id={q.id} archived={q.archived} />
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </AppShell>
  );
}
