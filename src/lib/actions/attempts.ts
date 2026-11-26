'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { startOrResumeAttempt } from '@/lib/attempt-start';

export async function startAttemptAction(assignmentId: string, errorBase?: string) {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  const result = await startOrResumeAttempt(user, assignmentId);
  if (!result.ok) {
    redirect(`${errorBase ?? '/learn'}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/learn/attempts/${result.attemptId}`);
}
