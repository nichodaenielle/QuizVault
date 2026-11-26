import { prisma } from './prisma';
import type { SessionUser } from './auth';
import { isEnrolled } from './access';
import { buildAttemptItems, snapshotFrom } from './attempts-shared';
import type { Prisma } from '@prisma/client';

export type StartResult =
  | { ok: true; attemptId: string }
  | { ok: false; error: string };

export async function startOrResumeAttempt(
  user: SessionUser,
  assignmentId: string,
): Promise<StartResult> {
  const assignment = await prisma.sectionAssignment.findUnique({
    where: { id: assignmentId },
    include: { assessment: true, version: true, section: true },
  });
  if (!assignment || !assignment.versionId || !assignment.version) {
    return { ok: false, error: 'Assignment not found.' };
  }
  if (assignment.assessment.status !== 'PUBLISHED') {
    return { ok: false, error: 'This assessment is not open.' };
  }
  if (!(await isEnrolled(user.id, assignment.sectionId))) {
    return { ok: false, error: 'You are not enrolled in this section.' };
  }

  const now = new Date();
  if (assignment.opensAt && now < assignment.opensAt) {
    return { ok: false, error: 'This assessment has not opened yet.' };
  }
  if (assignment.closesAt && now > assignment.closesAt) {
    return { ok: false, error: 'This assessment has closed.' };
  }

  const existing = await prisma.attempt.findFirst({
    where: { assignmentId, userId: user.id, status: 'IN_PROGRESS' },
    orderBy: { attemptNumber: 'desc' },
  });
  if (existing) return { ok: true, attemptId: existing.id };

  const [used, inProgress] = await Promise.all([
    prisma.attempt.count({ where: { assignmentId, userId: user.id, status: 'SUBMITTED' } }),
    prisma.attempt.count({ where: { assignmentId, userId: user.id, status: 'IN_PROGRESS' } }),
  ]);
  if (used + inProgress >= assignment.attemptLimit) {
    return { ok: false, error: 'Attempt limit reached.' };
  }

  const snap = snapshotFrom(assignment.version);
  if (!snap) return { ok: false, error: 'Assessment snapshot missing.' };

  const { items, itemOrder } = buildAttemptItems(snap, {
    shuffleQuestions: assignment.shuffleQuestions,
    shuffleOptions: assignment.shuffleOptions,
  });

  let deadlineAt: Date | null = assignment.closesAt ?? null;
  if (assignment.timeLimitSec) {
    const t = new Date(now.getTime() + assignment.timeLimitSec * 1000);
    deadlineAt = deadlineAt && deadlineAt < t ? deadlineAt : t;
  }

  try {
    const attempt = await prisma.attempt.create({
      data: {
        assignmentId,
        assessmentId: assignment.assessmentId,
        versionId: assignment.versionId,
        userId: user.id,
        attemptNumber: used + inProgress + 1,
        itemOrder: itemOrder as unknown as Prisma.InputJsonValue,
        items: items as unknown as Prisma.InputJsonValue,
        deadlineAt,
      },
    });
    return { ok: true, attemptId: attempt.id };
  } catch (e) {
    const again = await prisma.attempt.findFirst({
      where: { assignmentId, userId: user.id, status: 'IN_PROGRESS' },
      orderBy: { attemptNumber: 'desc' },
    });
    if (again) return { ok: true, attemptId: again.id };
    throw e;
  }
}
