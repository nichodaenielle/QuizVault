import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { Card } from '@/components/ui';
import { InviteAcceptForm } from './accept-form';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  LEARNER: 'Learner',
  INSTRUCTOR: 'Instructor',
  ADMIN: 'Admin',
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await prisma.invite.findUnique({
    where: { token },
    include: {
      section: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!row) notFound();
  const invite = {
    email: row.email,
    role: row.role,
    sectionName: row.section?.name ?? null,
    message: row.message,
    invitedByName: row.invitedBy.name,
    acceptedAt: row.acceptedAt,
    expired: row.expiresAt < new Date(),
  };

  const user = await getSessionUser();
  const emailMatch = !!user && user.email.toLowerCase() === invite.email.toLowerCase();

  const grants: string[] = [];
  if (invite.role) grants.push(`the ${ROLE_LABEL[invite.role] ?? invite.role} role`);
  if (invite.sectionName) grants.push(`enrollment in ${invite.sectionName}`);

  return (
    <main className="flex min-h-screen items-center justify-center bg-pine-900 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/QuizVault%20Logo%20Only.png"
            alt=""
            className="h-10 w-10 rounded-xl bg-ivory-100 object-contain p-1"
          />
          <div>
            <h1 className="text-lg font-semibold text-ink-900">You&apos;re invited</h1>
            <p className="text-sm text-ink-600">to join QuizVault</p>
          </div>
        </div>

        {invite.acceptedAt ? (
          <p className="rounded-lg border border-pine-800/20 bg-pine-50 px-3 py-2 text-sm text-pine-900">
            This invite has already been accepted.
          </p>
        ) : invite.expired ? (
          <p className="rounded-lg border border-gold-500/40 bg-gold-100 px-3 py-2 text-sm text-ink-900">
            This invite link has expired. Ask the sender for a new one.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-900">
              <strong>{invite.invitedByName ?? 'A QuizVault user'}</strong> invited{' '}
              <strong>{invite.email}</strong>
              {grants.length > 0 && <> to join as {grants.join(' and ')}.</>}
            </p>
            {invite.message && (
              <p className="mt-3 rounded-lg bg-ivory-50 p-3 text-sm italic text-ink-600">
                &ldquo;{invite.message}&rdquo;
              </p>
            )}

            {!user ? (
              <div className="mt-5">
                <p className="mb-3 text-sm text-ink-600">
                  Sign in with Google using <strong>{invite.email}</strong> to accept.
                </p>
                <Link
                  href="/sign-in"
                  className="flex w-full items-center justify-center rounded-lg bg-pine-900 px-4 py-3 text-sm font-medium text-ivory-50 hover:bg-pine-800"
                >
                  Sign in to accept
                </Link>
              </div>
            ) : !emailMatch ? (
              <div className="mt-5 rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-800">
                <p>
                  You&apos;re signed in as <strong>{user.email}</strong>, but this invite
                  was sent to <strong>{invite.email}</strong>.
                </p>
                <p className="mt-1">Sign out and sign in with the invited Google account.</p>
                <form action="/api/auth/signout" method="post" className="mt-3">
                  <button type="submit" className="text-sm font-medium text-red-800 underline">
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <InviteAcceptForm token={token} defaultName={user.name ?? ''} />
            )}
          </>
        )}
      </Card>
    </main>
  );
}
