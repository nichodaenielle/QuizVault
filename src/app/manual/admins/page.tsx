import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';
import { Flow, ManualSection, Shot, Tip } from '@/components/manual';

export const dynamic = 'force-dynamic';

export default async function AdminManual() {
  const user = await requireRole('ADMIN');
  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/users', label: 'Users & roles' },
        { href: '/admin/sections', label: 'Sections' },
        { href: '/admin/invites', label: 'Invites' },
        { href: '/admin/activity', label: 'Activity' },
      ]}
    >
      <PageHeader
        title="Admin guide"
        subtitle="Admins are also instructors — everything in the instructor guide applies. This page covers the admin-only tools."
      />

      <ManualSection id="roles" title="1. Roles & permissions">
        <p>
          QuizVault has three roles. <strong>Learners</strong> join sections and take assessments.{' '}
          <strong>Instructors</strong> additionally create questions, sets, assessments, sections, and grade.
          <strong> Admins</strong> can do everything instructors can, plus manage users, roles, all sections,
          invites, and the audit log. The view switcher in the header lets admins flip between the admin and
          instructor dashboards.
        </p>
        <Flow
          steps={[
            { title: 'Learner', body: 'Join sections, take assessments, view results.' },
            { title: 'Instructor', body: 'Everything a learner can, plus authoring and grading.' },
            { title: 'Admin', body: 'Everything an instructor can, plus platform administration.' },
          ]}
        />
        <Shot src="admin-teach-dashboard" alt="Admin view of the instructor dashboard" caption="Admins can switch to the instructor view from the header to author content and grade just like an instructor." />
      </ManualSection>

      <ManualSection id="dashboard" title="2. Admin dashboard">
        <p>
          Platform stats, a role-distribution card, recent signups, and a live feed of recent activity pulled
          from the audit log.
        </p>
        <Shot
          src="admin-dashboard"
          alt="Admin dashboard"
          legend={[
            'Users by role — learner, instructor, and admin counts at a glance.',
            'Recent activity — the latest audited actions across the platform.',
          ]}
        />
      </ManualSection>

      <ManualSection id="users" title="3. Users & roles">
        <p>
          The Users page lists every account with its role. Change roles here — you cannot change your own
          role or demote the last remaining admin, and every change is written to the audit log. New users
          appear automatically after their first Google sign-in.
        </p>
        <Shot
          src="admin-users"
          alt="Users and roles page"
          legend={['User table — email, name, role, and join date; role changes happen inline.']}
        />
      </ManualSection>

      <ManualSection id="sections-admin" title="4. Sections oversight">
        <p>
          The admin Sections page shows every section across all instructors — useful for support and audits.
          Day-to-day section management (codes, rosters, assignments) still happens in the instructor view.
        </p>
        <Shot src="admin-sections" alt="Admin sections page" />
      </ManualSection>

      <ManualSection id="invites-admin" title="5. Invites">
        <p>
          Create email-bound invite links for learners or instructors. If your email is on the{' '}
          <code>ADMIN_INVITE_EMAILS</code> allowlist, the role dropdown also offers <strong>Admin</strong> —
          the only way to grant admin access by link. Invites expire, are single-use, and can be revoked.
        </p>
        <Shot src="admin-invites" alt="Admin invites page" />
        <Tip>
          To add another admin without an invite: have them sign in once, then promote them on the Users page —
          or create an admin invite if your email is allowlisted.
        </Tip>
      </ManualSection>

      <ManualSection id="activity" title="6. Activity log">
        <p>
          Every meaningful action — sign-ins with role changes, questions created, assessments published,
          invites sent, role changes — is recorded in the audit log. The Activity page lets you search and
          filter by action, entity, actor, and date range, paginated 100 entries at a time.
        </p>
        <Shot
          src="admin-activity"
          alt="Admin activity log"
          legend={[
            'Download .txt — exports the full filtered result set (up to 10,000 rows) as a plain-text file.',
            'Search — filters by action, entity, actor name/email, entity ID, and meta; dropdowns and date pickers narrow further.',
          ]}
        />
      </ManualSection>
    </AppShell>
  );
}
