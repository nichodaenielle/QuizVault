import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { startOrResumeAttempt } from '@/lib/attempt-start';
import { attemptPayload } from '@/lib/attempt-payload';

export const runtime = 'nodejs';

/** Start (or resume) an attempt for an assignment. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { assignmentId } = await params;
  const result = await startOrResumeAttempt(user, assignmentId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(await attemptPayload(result.attemptId));
}
