import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { attemptForUser } from '@/lib/attempts-shared';
import { finalizeAttempt } from '@/lib/attempts';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/** Submit an attempt. Idempotent: repeated calls return the finalized state. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { attemptId } = await params;
  const attempt = await attemptForUser(attemptId, user);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });

  if (attempt.status === 'IN_PROGRESS') {
    await finalizeAttempt(attemptId);
  }

  const fresh = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  return NextResponse.json({
    ok: true,
    status: fresh.status,
    submittedAt: fresh.submittedAt,
    gradingStatus: fresh.gradingStatus,
  });
}
