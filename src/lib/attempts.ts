import { prisma } from './prisma';
import {
  autoGrade,
  answerIsPresent,
  isObjective,
  type AnswerValue,
  type Snapshot,
  type SnapshotItem,
} from './questions';
import { Prisma } from '@prisma/client';

function snapshotOf(version: { snapshot: Prisma.JsonValue } | null | undefined): Snapshot | null {
  if (!version?.snapshot || typeof version.snapshot !== 'object') return null;
  return version.snapshot as unknown as Snapshot;
}

/**
 * Finalize an attempt: auto-grade objective responses, flag essays for manual
 * grading, and mark the attempt SUBMITTED. Idempotent and safe under
 * concurrency — only the first caller transitions the status.
 */
export async function finalizeAttempt(attemptId: string): Promise<boolean> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { version: true, responses: true },
  });
  if (!attempt || attempt.status !== 'IN_PROGRESS') return false;
  const snap = snapshotOf(attempt.version);
  if (!snap) return false;

  const items = orderItems(snap.items, attempt.itemOrder);
  const responseByKey = new Map(attempt.responses.map((r) => [r.itemKey, r]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let autoScore = 0;
  let maxScore = 0;
  let pendingEssays = 0;

  for (const item of items) {
    maxScore += item.points;
    const resp = responseByKey.get(item.key);
    const answer = (resp?.answer ?? null) as AnswerValue;
    const hasAnswer = answerIsPresent(item.type, answer);

    if (isObjective(item.type)) {
      const score = hasAnswer ? autoGrade(item.type, item.payload, answer, item.points) ?? 0 : 0;
      autoScore += score;
      ops.push(
        prisma.response.upsert({
          where: { attemptId_itemKey: { attemptId, itemKey: item.key } },
          create: {
            attemptId,
            itemKey: item.key,
            answer: answer == null ? Prisma.DbNull : (answer as Prisma.InputJsonValue),
            isCorrect: score === item.points && hasAnswer,
            score,
            maxScore: item.points,
          },
          update: {
            answer: answer == null ? Prisma.DbNull : (answer as Prisma.InputJsonValue),
            isCorrect: score === item.points && hasAnswer,
            score,
            maxScore: item.points,
          },
        }),
      );
    } else {
      // Essay: keep saved answer; score stays null until manual grading.
      if (!hasAnswer) {
        // Unanswered essay scores 0 automatically.
        ops.push(
          prisma.response.upsert({
            where: { attemptId_itemKey: { attemptId, itemKey: item.key } },
            create: { attemptId, itemKey: item.key, answer: Prisma.DbNull, score: 0, maxScore: item.points },
            update: { score: 0, maxScore: item.points },
          }),
        );
      } else {
        pendingEssays += 1;
        ops.push(
          prisma.response.upsert({
            where: { attemptId_itemKey: { attemptId, itemKey: item.key } },
            create: {
              attemptId,
              itemKey: item.key,
              answer: answer as Prisma.InputJsonValue,
              maxScore: item.points,
            },
            update: { maxScore: item.points },
          }),
        );
      }
    }
  }

  const gradingStatus = pendingEssays > 0 ? 'PENDING_GRADING' : 'AUTO_GRADED';

  // Atomic status transition guards against double submission.
  const transitioned = await prisma.attempt.updateMany({
    where: { id: attemptId, status: 'IN_PROGRESS' },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      score: gradingStatus === 'AUTO_GRADED' ? autoScore : autoScore, // provisional; recomputed after essay grading
      maxScore,
      gradingStatus,
    },
  });
  if (transitioned.count === 0) return false;

  await prisma.$transaction(ops);
  await recomputeAttemptScore(attemptId);
  return true;
}

export function orderItems(items: SnapshotItem[], itemOrder: Prisma.JsonValue): SnapshotItem[] {
  if (!Array.isArray(itemOrder) || itemOrder.length === 0) return items;
  const byKey = new Map(items.map((i) => [i.key, i]));
  const ordered: SnapshotItem[] = [];
  for (const k of itemOrder) {
    if (typeof k === 'string' && byKey.has(k)) ordered.push(byKey.get(k)!);
  }
  // Append any items missing from the order (shouldn't happen, but safe).
  for (const i of items) if (!ordered.includes(i)) ordered.push(i);
  return ordered;
}

/** Recompute attempt totals from response rows. Marks GRADED when nothing pending. */
export async function recomputeAttemptScore(attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { responses: { include: { grade: true } }, version: true },
  });
  if (!attempt || attempt.status !== 'SUBMITTED') return;
  const snap = snapshotOf(attempt.version);
  if (!snap) return;
  const items = orderItems(snap.items, attempt.itemOrder);
  const byKey = new Map(attempt.responses.map((r) => [r.itemKey, r]));

  let score = 0;
  let maxScore = 0;
  let pending = 0;
  for (const item of items) {
    maxScore += item.points;
    const resp = byKey.get(item.key);
    if (item.type === 'ESSAY') {
      if (resp?.answer != null && resp.grade == null) pending += 1;
      score += resp?.score ?? 0;
    } else {
      score += resp?.score ?? 0;
    }
  }
  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      score,
      maxScore,
      gradingStatus: pending > 0 ? 'PENDING_GRADING' : 'GRADED',
    },
  });
}

/** Finalize every in-progress attempt whose deadline has passed. */
export async function finalizeExpiredAttempts(): Promise<number> {
  const now = new Date();
  const expired = await prisma.attempt.findMany({
    where: { status: 'IN_PROGRESS', deadlineAt: { lt: now } },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const a of expired) {
    if (await finalizeAttempt(a.id)) n += 1;
  }
  return n;
}
