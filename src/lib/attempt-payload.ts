import { prisma } from './prisma';
import { learnerItem } from './attempts-shared';
import type { AnswerValue, SnapshotItem } from './questions';

/** Learner-safe payload for an attempt: stripped items + saved answers. */
export async function attemptPayload(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { responses: true },
  });
  const items = (attempt.items as unknown as SnapshotItem[] | null) ?? [];
  return {
    attemptId: attempt.id,
    status: attempt.status,
    deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    items: items.map(learnerItem),
    responses: Object.fromEntries(
      attempt.responses.map((r) => [r.itemKey, r.answer]),
    ) as Record<string, AnswerValue>,
    flags: (attempt.flags as Record<string, boolean> | null) ?? {},
  };
}
