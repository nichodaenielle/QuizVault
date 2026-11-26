import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { attemptForUser } from '@/lib/attempts-shared';
import { finalizeAttempt } from '@/lib/attempts';
import { attemptPayload } from '@/lib/attempt-payload';

export const runtime = 'nodejs';

/** Resume payload for the runner: items (keys stripped), saved answers, timing. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { attemptId } = await params;
  const attempt = await attemptForUser(attemptId, user);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });

  // Opportunistic expiry finalization.
  if (attempt.status === 'IN_PROGRESS' && attempt.deadlineAt && new Date() > attempt.deadlineAt) {
    await finalizeAttempt(attemptId);
  }

  return NextResponse.json(await attemptPayload(attemptId));
}
