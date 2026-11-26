import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { JoinForm } from './join-form';

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  return (
    <AppShell user={user} nav={[{ href: '/learn', label: 'Dashboard' }, { href: '/learn/join', label: 'Join section' }]}>
      <PageHeader title="Join a section" subtitle="Enter the class code shared by your instructor." />
      <div className="max-w-md">
        <JoinForm />
      </div>
    </AppShell>
  );
}
