import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { listInvites } from '@/lib/actions/invites';
import { InviteManager } from './invite-manager';

export const dynamic = 'force-dynamic';

export default async function AdminInvitesPage() {
  const user = await requireRole('ADMIN');
  const [invites, sections] = await Promise.all([
    listInvites(),
    prisma.section.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/users', label: 'Users & roles' },
        { href: '/admin/sections', label: 'Sections' },
        { href: '/admin/invites', label: 'Invites' },
        { href: '/admin/activity', label: 'Activity' },
      ]}
    >
      <PageHeader
        title="Invites"
        subtitle="Email invite links that grant a role, enroll in a section, or both on acceptance."
      />
      <InviteManager initialInvites={invites} isAdmin sections={sections} />
    </AppShell>
  );
}
