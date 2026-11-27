import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const GUIDES = [
  {
    href: '/manual/learners',
    title: 'Learner guide',
    body: 'Join sections with a class code, take timed quizzes and exams, and review your released results.',
  },
  {
    href: '/manual/instructors',
    title: 'Instructor guide',
    body: 'Build question banks and sets, publish assessments, manage sections and class codes, and grade essays.',
  },
  {
    href: '/manual/admins',
    title: 'Admin guide',
    body: 'Everything instructors can do, plus user and role management, platform sections, invites, and the audit log.',
  },
];

export default async function ManualPage() {
  const user = await requireUser();
  return (
    <AppShell
      user={user}
      nav={[{ href: user.role === 'LEARNER' ? '/learn' : user.role === 'INSTRUCTOR' ? '/teach' : '/admin', label: 'Dashboard' }]}
    >
      <PageHeader title="QuizVault user manual" subtitle="Task guides for every role, with screenshots of the real app." />
      <div className="grid gap-4 sm:grid-cols-3">
        {GUIDES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="rounded-xl border border-ink-400/15 bg-white p-5 shadow-sm transition hover:border-pine-800/40 hover:shadow"
          >
            <h2 className="font-semibold text-ink-900">{g.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">{g.body}</p>
            <p className="mt-3 text-sm font-medium text-pine-800">Open guide →</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-600">
        Numbered badges on the screenshots match the numbered notes beneath each image.
      </p>
    </AppShell>
  );
}
