import { redirect, notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { attemptForUser } from '@/lib/attempts-shared';
import { attemptPayload } from '@/lib/attempt-payload';
import { Runner } from './runner';

export const dynamic = 'force-dynamic';

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  const { attemptId } = await params;
  const attempt = await attemptForUser(attemptId, user);
  if (!attempt) notFound();
  if (attempt.status === 'SUBMITTED') redirect(`/learn/results/${attemptId}`);

  const payload = await attemptPayload(attemptId);
  return (
    <Runner
      payload={payload}
      mode={attempt.assessment.mode}
      title={attempt.assessment.title}
    />
  );
}
