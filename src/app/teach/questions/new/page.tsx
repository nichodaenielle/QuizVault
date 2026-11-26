import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { QuestionForm } from '../question-form';

export const dynamic = 'force-dynamic';

export default async function NewQuestionPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
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
      <PageHeader title="New question" subtitle="Add a question to your bank." />
      <div className="mx-auto max-w-3xl">
        <QuestionForm />
      </div>
    </AppShell>
  );
}
