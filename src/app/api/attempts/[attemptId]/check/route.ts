import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { attemptForUser } from '@/lib/attempts-shared';
import { autoGrade, answerIsPresent, type AnswerValue, type SnapshotItem } from '@/lib/questions';

export const runtime = 'nodejs';

/**
 * Instant self-check for REVIEWER-mode attempts (and post-release checks).
 * Returns correctness without mutating saved state.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { attemptId } = await params;
  const attempt = await attemptForUser(attemptId, user);
  if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { itemKey?: string; answer?: AnswerValue } | null;
  if (!body?.itemKey) return NextResponse.json({ error: 'itemKey required' }, { status: 400 });

  const items = (attempt.items as unknown as SnapshotItem[] | null) ?? [];
  const item = items.find((i) => i.key === body.itemKey);
  if (!item) return NextResponse.json({ error: 'Unknown item' }, { status: 404 });
  if (item.type === 'ESSAY') {
    return NextResponse.json({ error: 'Essays are graded manually.' }, { status: 400 });
  }

  const score = autoGrade(item.type, item.payload, body.answer ?? null, item.points) ?? 0;
  const correct = answerIsPresent(item.type, body.answer ?? null) && score === item.points;
  return NextResponse.json({ correct, score, maxScore: item.points });
}
