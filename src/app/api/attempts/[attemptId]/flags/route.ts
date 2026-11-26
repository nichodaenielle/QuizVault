import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { attemptForUser } from '@/lib/attempts-shared';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

/** Toggle a review flag on an attempt item. Persisted on the attempt. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { attemptId } = await params;
  const attempt = await attemptForUser(attemptId, user);
  if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (attempt.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Attempt closed.' }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { itemKey?: string; flagged?: boolean } | null;
  if (!body?.itemKey || typeof body.flagged !== 'boolean') {
    return NextResponse.json({ error: 'itemKey and flagged required.' }, { status: 400 });
  }

  const flags = { ...((attempt.flags as Record<string, boolean> | null) ?? {}) };
  if (body.flagged) flags[body.itemKey] = true;
  else delete flags[body.itemKey];

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { flags: flags as Prisma.InputJsonValue },
  });
  return NextResponse.json({ ok: true, flags });
}
