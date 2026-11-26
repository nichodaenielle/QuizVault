import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { AssessmentForm } from './form';

export const dynamic = 'force-dynamic';

export default async function NewAssessmentPage() {
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
        { href: '/teach/grading', label: 'Grading' },
      ]}
    >
      <PageHeader title="New assessment" subtitle="Choose a mode — any mode supports all question types." />
      <div className="max-w-xl">
        <AssessmentForm />
      </div>
    </AppShell>
  );
}
