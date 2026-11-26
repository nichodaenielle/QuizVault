import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { attemptForUser } from '@/lib/attempts-shared';
import { finalizeAttempt } from '@/lib/attempts';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// navigator.sendBeacon always issues POST — alias it to the same handler so
// the unload-flush path actually persists answers.
export { PUT as POST };

/**
 * Autosave answers. Accepts either { itemKey, answer } for a single item or
 * { answers: { [itemKey]: answer } } for a batch. Upserts are idempotent.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { attemptId } = await params;
  const attempt = await attemptForUser(attemptId, user);
  if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });

  if (attempt.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Attempt already submitted.', saved: false }, { status: 409 });
  }
  if (attempt.deadlineAt && new Date() > attempt.deadlineAt) {
    await finalizeAttempt(attemptId);
    return NextResponse.json({ error: 'Time expired.', saved: false, expired: true }, { status: 410 });
  }

  const body = (await req.json().catch(() => null)) as {
    itemKey?: string;
    answer?: unknown;
    answers?: Record<string, unknown>;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });

  const entries: [string, unknown][] = [];
  if (body.answers && typeof body.answers === 'object') {
    for (const [k, v] of Object.entries(body.answers)) entries.push([k, v]);
  } else if (body.itemKey) {
    entries.push([body.itemKey, body.answer]);
  } else {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }

  // Only accept keys that exist in this attempt's item set.
  const validKeys = new Set(
    ((attempt.items as unknown as { key: string }[]) ?? []).map((i) => i.key),
  );
  const ops = entries
    .filter(([k]) => validKeys.has(k))
    .map(([itemKey, answer]) =>
      prisma.response.upsert({
        where: { attemptId_itemKey: { attemptId, itemKey } },
        create: {
          attemptId,
          itemKey,
          answer: answer == null ? Prisma.DbNull : (answer as Prisma.InputJsonValue),
        },
        update: {
          answer: answer == null ? Prisma.DbNull : (answer as Prisma.InputJsonValue),
        },
      }),
    );
  if (ops.length) await prisma.$transaction(ops);

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
