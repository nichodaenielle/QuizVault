import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { instructorSectionIds } from '@/lib/access';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { listInvites } from '@/lib/actions/invites';
import { InviteManager } from '@/app/admin/invites/invite-manager';

export const dynamic = 'force-dynamic';

export default async function TeachInvitesPage() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const isAdmin = user.role === 'ADMIN';
  const sectionIds = isAdmin ? null : await instructorSectionIds(user.id);

  const [invites, sections] = await Promise.all([
    listInvites(),
    prisma.section.findMany({
      where: sectionIds ? { id: { in: sectionIds } } : {},
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
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
        title="Invites"
        subtitle={
          isAdmin
            ? 'Email invite links that grant a role, enroll in a section, or both on acceptance.'
            : 'Invite learners into your sections by email link.'
        }
      />
      <InviteManager initialInvites={invites} isAdmin={isAdmin} sections={sections} />
    </AppShell>
  );
}
