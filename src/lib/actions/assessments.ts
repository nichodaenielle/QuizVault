'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { audit, canManageSection } from '@/lib/access';
import { recomputeAttemptScore } from '@/lib/attempts';
import {
  DEFAULT_RELEASE,
  type AssessmentSettings,
  type FeedbackRelease,
  type Snapshot,
  type SnapshotItem,
} from '@/lib/questions';
import type { AssessmentMode, Prisma } from '@prisma/client';
import type { ActionResult } from './sections';

// ---------- Draft spec ----------

export type DraftItem =
  | { kind: 'QUESTION'; questionId: string }
  | { kind: 'SET'; setId: string }
  | { kind: 'RANDOM'; setId: string; count: number };

export interface DraftSpec {
  items: DraftItem[];
  settings: AssessmentSettings & { sectionIds?: string[] };
}

const EMPTY_DRAFT: DraftSpec = { items: [], settings: {} };

export async function createAssessment(input: {
  title: string;
  description?: string;
  mode: AssessmentMode;
}): Promise<ActionResult & { id?: string }> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Title is required.' };
  const a = await prisma.assessment.create({
    data: {
      ownerId: user.id,
      title,
      description: input.description?.trim() || null,
      mode: input.mode,
      draft: EMPTY_DRAFT as unknown as Prisma.InputJsonValue,
    },
  });
  await audit(user.id, 'ASSESSMENT_CREATED', 'Assessment', a.id, { mode: input.mode });
  revalidatePath('/teach/assessments');
  return { ok: true, id: a.id };
}

async function ownedAssessment(id: string, userId: string, isAdmin: boolean) {
  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a) return null;
  if (!isAdmin && a.ownerId !== userId) return null;
  return a;
}

export async function saveAssessmentDraft(id: string, spec: DraftSpec): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const a = await ownedAssessment(id, user.id, user.role === 'ADMIN');
  if (!a) return { ok: false, error: 'Assessment not found.' };
  if (a.status === 'ARCHIVED') return { ok: false, error: 'Archived assessments cannot be edited.' };

  // Validate referenced questions/sets exist.
  const qIds = spec.items.filter((i) => i.kind === 'QUESTION').map((i) => (i as { questionId: string }).questionId);
  const setIds = spec.items
    .filter((i) => i.kind === 'SET' || i.kind === 'RANDOM')
    .map((i) => (i as { setId: string }).setId);
  const [qs, sets] = await Promise.all([
    qIds.length ? prisma.question.count({ where: { id: { in: qIds } } }) : 0,
    setIds.length ? prisma.questionSet.count({ where: { id: { in: setIds }, archived: false } }) : 0,
  ]);
  if (qs !== new Set(qIds).size) return { ok: false, error: 'One or more questions no longer exist.' };
  if (sets !== new Set(setIds).size) return { ok: false, error: 'One or more question sets no longer exist.' };
  for (const item of spec.items) {
    if (item.kind === 'RANDOM' && (!Number.isInteger(item.count) || item.count < 1)) {
      return { ok: false, error: 'Random draw count must be a positive integer.' };
    }
  }

  await prisma.assessment.update({
    where: { id },
    data: { draft: spec as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/teach/assessments/${id}`);
  return { ok: true };
}

/** Resolve the draft into an immutable snapshot. */
async function resolveSnapshot(a: { id: string; title: string; mode: AssessmentMode; draft: Prisma.JsonValue }) {
  const draft = (a.draft ?? EMPTY_DRAFT) as DraftSpec;
  const items: SnapshotItem[] = [];
  let n = 0;

  const pushQuestion = (q: {
    id: string; type: SnapshotItem['type']; prompt: string; points: number;
    payload: Prisma.JsonValue; explanation: string | null; topic: string; subject: string;
  }) => {
    items.push({
      key: `i${n++}`,
      refId: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      payload: q.payload as SnapshotItem['payload'],
      explanation: q.explanation,
      topic: q.topic,
      subject: q.subject,
    });
  };

  for (const item of draft.items) {
    if (item.kind === 'QUESTION') {
      const q = await prisma.question.findUnique({ where: { id: item.questionId } });
      if (!q) return { error: `Question ${item.questionId} not found.` } as const;
      if (q.archived) continue;
      pushQuestion(q);
    } else if (item.kind === 'SET') {
      const rows = await prisma.questionSetItem.findMany({
        where: { setId: item.setId, question: { archived: false } },
        orderBy: { order: 'asc' },
        include: { question: true },
      });
      for (const r of rows) pushQuestion(r.question);
    } else {
      const rows = await prisma.questionSetItem.findMany({
        where: { setId: item.setId, question: { archived: false } },
        include: { question: true },
      });
      const pool = [...rows];
      // Fisher-Yates shuffle then take `count`.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      for (const r of pool.slice(0, item.count)) pushQuestion(r.question);
    }
  }

  if (items.length === 0) return { error: 'The assessment has no questions.' } as const;

  const settings: AssessmentSettings = {
    ...draft.settings,
    feedbackRelease: { ...DEFAULT_RELEASE, ...(draft.settings.feedbackRelease ?? {}) },
  };

  const snapshot: Snapshot = {
    mode: a.mode,
    title: a.title,
    items,
    settings,
  };
  return { snapshot, draft } as const;
}

/** Publish (or re-publish) the current draft as a new immutable version. */
export async function publishAssessment(
  id: string,
  sectionIds: string[],
): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const a = await ownedAssessment(id, user.id, user.role === 'ADMIN');
  if (!a) return { ok: false, error: 'Assessment not found.' };
  if (a.status === 'ARCHIVED') return { ok: false, error: 'Archived assessments cannot be published.' };
  if (sectionIds.length === 0) return { ok: false, error: 'Select at least one section.' };

  // Instructors may only publish to sections they manage.
  for (const sid of sectionIds) {
    if (!(await canManageSection(user, sid))) {
      return { ok: false, error: 'You can only publish to sections you manage.' };
    }
  }

  const resolved = await resolveSnapshot(a);
  if ('error' in resolved) return { ok: false, error: resolved.error };
  const { snapshot, draft } = resolved;

  const versionCount = await prisma.assessmentVersion.count({ where: { assessmentId: id } });

  await prisma.$transaction(async (tx) => {
    const version = await tx.assessmentVersion.create({
      data: {
        assessmentId: id,
        version: versionCount + 1,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        publishedBy: user.id,
      },
    });
    await tx.assessment.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
    const s = draft.settings;
    for (const sid of sectionIds) {
      const data = {
        versionId: version.id,
        opensAt: s.opensAt ? new Date(s.opensAt) : null,
        closesAt: s.closesAt ? new Date(s.closesAt) : null,
        timeLimitSec: s.timeLimitSec ?? null,
        attemptLimit: s.attemptLimit ?? 1,
        shuffleQuestions: s.shuffleQuestions ?? false,
        shuffleOptions: s.shuffleOptions ?? false,
        feedbackRelease: (s.feedbackRelease ?? DEFAULT_RELEASE) as unknown as Prisma.InputJsonValue,
      };
      await tx.sectionAssignment.upsert({
        where: { assessmentId_sectionId: { assessmentId: id, sectionId: sid } },
        update: data,
        create: { assessmentId: id, sectionId: sid, createdById: user.id, ...data },
      });
    }
    // Remove assignments for sections no longer selected and without attempts.
    const removed = await tx.sectionAssignment.findMany({
      where: { assessmentId: id, sectionId: { notIn: sectionIds }, attempts: { none: {} } },
      select: { id: true },
    });
    if (removed.length) {
      await tx.sectionAssignment.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    }
  });

  await audit(user.id, 'ASSESSMENT_PUBLISHED', 'Assessment', id, { version: versionCount + 1, sections: sectionIds.length });
  revalidatePath('/teach/assessments');
  revalidatePath(`/teach/assessments/${id}`);
  return { ok: true };
}

export async function setAssessmentStatus(id: string, status: 'CLOSED' | 'PUBLISHED' | 'ARCHIVED'): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const a = await ownedAssessment(id, user.id, user.role === 'ADMIN');
  if (!a) return { ok: false, error: 'Assessment not found.' };
  if (a.status === 'ARCHIVED') {
    return { ok: false, error: 'Archived assessments must be restored first.' };
  }
  if (status === 'PUBLISHED' && a.status === 'DRAFT') {
    return { ok: false, error: 'Publish the draft first.' };
  }
  await prisma.assessment.update({ where: { id }, data: { status } });
  await audit(user.id, `ASSESSMENT_${status}`, 'Assessment', id);
  revalidatePath('/teach/assessments');
  revalidatePath(`/teach/assessments/${id}`);
  return { ok: true };
}

/** Restore an archived assessment: back to PUBLISHED if it has versions, else DRAFT. */
export async function restoreAssessment(id: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const a = await ownedAssessment(id, user.id, user.role === 'ADMIN');
  if (!a) return { ok: false, error: 'Assessment not found.' };
  if (a.status !== 'ARCHIVED') return { ok: false, error: 'Only archived assessments can be restored.' };
  const hasVersion = (await prisma.assessmentVersion.count({ where: { assessmentId: id } })) > 0;
  await prisma.assessment.update({
    where: { id },
    data: { status: hasVersion ? 'PUBLISHED' : 'DRAFT' },
  });
  await audit(user.id, 'ASSESSMENT_RESTORED', 'Assessment', id, { to: hasVersion ? 'PUBLISHED' : 'DRAFT' });
  revalidatePath('/teach/assessments');
  revalidatePath(`/teach/assessments/${id}`);
  return { ok: true };
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const a = await ownedAssessment(id, user.id, user.role === 'ADMIN');
  if (!a) return { ok: false, error: 'Assessment not found.' };
  if (a.status !== 'DRAFT') return { ok: false, error: 'Only draft assessments can be deleted.' };
  const attempts = await prisma.attempt.count({ where: { assessmentId: id } });
  if (attempts > 0) return { ok: false, error: 'Assessment has attempts and cannot be deleted.' };
  await prisma.assessment.delete({ where: { id } });
  revalidatePath('/teach/assessments');
  return { ok: true };
}

export interface AssignmentSettingsInput {
  opensAt?: string | null;
  closesAt?: string | null;
  timeLimitSec?: number | null;
  attemptLimit?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  feedbackRelease?: FeedbackRelease;
}

export async function updateAssignmentSettings(
  assignmentId: string,
  input: AssignmentSettingsInput,
): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const assignment = await prisma.sectionAssignment.findUnique({
    where: { id: assignmentId },
    include: { assessment: true, section: true },
  });
  if (!assignment) return { ok: false, error: 'Assignment not found.' };
  if (user.role === 'INSTRUCTOR') {
    if (assignment.assessment.ownerId !== user.id && !(await canManageSection(user, assignment.sectionId))) {
      return { ok: false, error: 'Access denied.' };
    }
  }
  if (assignment.assessment.status === 'ARCHIVED') {
    return { ok: false, error: 'Cannot edit an archived assessment.' };
  }

  const data: Prisma.SectionAssignmentUpdateInput = {};
  if (input.opensAt !== undefined) data.opensAt = input.opensAt ? new Date(input.opensAt) : null;
  if (input.closesAt !== undefined) data.closesAt = input.closesAt ? new Date(input.closesAt) : null;
  if (input.timeLimitSec !== undefined) data.timeLimitSec = input.timeLimitSec;
  if (input.attemptLimit !== undefined) {
    if (!Number.isInteger(input.attemptLimit) || input.attemptLimit < 1) {
      return { ok: false, error: 'Attempt limit must be a positive integer.' };
    }
    data.attemptLimit = input.attemptLimit;
  }
  if (input.shuffleQuestions !== undefined) data.shuffleQuestions = input.shuffleQuestions;
  if (input.shuffleOptions !== undefined) data.shuffleOptions = input.shuffleOptions;
  if (input.feedbackRelease !== undefined) {
    data.feedbackRelease = { ...DEFAULT_RELEASE, ...input.feedbackRelease } as Prisma.InputJsonValue;
  }
  await prisma.sectionAssignment.update({ where: { id: assignmentId }, data });
  await audit(user.id, 'ASSIGNMENT_UPDATED', 'SectionAssignment', assignmentId);
  revalidatePath(`/teach/assessments/${assignment.assessmentId}`);
  return { ok: true };
}

export async function removeAssignment(assignmentId: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const assignment = await prisma.sectionAssignment.findUnique({
    where: { id: assignmentId },
    include: { assessment: true },
  });
  if (!assignment) return { ok: false, error: 'Assignment not found.' };
  if (user.role === 'INSTRUCTOR' && assignment.assessment.ownerId !== user.id) {
    if (!(await canManageSection(user, assignment.sectionId))) return { ok: false, error: 'Access denied.' };
  }
  const attempts = await prisma.attempt.count({ where: { assignmentId } });
  if (attempts > 0) {
    return { ok: false, error: 'Section has attempts; close the assignment instead of removing it.' };
  }
  await prisma.sectionAssignment.delete({ where: { id: assignmentId } });
  await audit(user.id, 'ASSIGNMENT_REMOVED', 'SectionAssignment', assignmentId);
  revalidatePath(`/teach/assessments/${assignment.assessmentId}`);
  return { ok: true };
}

// ---------- Grading ----------

export async function gradeEssay(
  responseId: string,
  input: { score: number; maxScore: number; feedback?: string; rubricScores?: unknown },
): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const resp = await prisma.response.findUnique({
    where: { id: responseId },
    include: { attempt: { include: { assignment: true, assessment: true } } },
  });
  if (!resp) return { ok: false, error: 'Response not found.' };
  if (user.role === 'INSTRUCTOR') {
    const allowed =
      resp.attempt.assessment.ownerId === user.id ||
      (await canManageSection(user, resp.attempt.assignment.sectionId));
    if (!allowed) return { ok: false, error: 'Access denied.' };
  }
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > input.maxScore) {
    return { ok: false, error: `Score must be between 0 and ${input.maxScore}.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.essayGrade.upsert({
      where: { responseId },
      create: {
        responseId,
        attemptId: resp.attemptId,
        score: input.score,
        maxScore: input.maxScore,
        rubricScores: (input.rubricScores ?? undefined) as Prisma.InputJsonValue | undefined,
        feedback: input.feedback?.trim() || null,
        gradedById: user.id,
      },
      update: {
        score: input.score,
        maxScore: input.maxScore,
        rubricScores: (input.rubricScores ?? undefined) as Prisma.InputJsonValue | undefined,
        feedback: input.feedback?.trim() || null,
        gradedById: user.id,
        gradedAt: new Date(),
      },
    });
    await tx.response.update({ where: { id: responseId }, data: { score: input.score, maxScore: input.maxScore } });
  });
  await recomputeAttemptScore(resp.attemptId);
  await audit(user.id, 'ESSAY_GRADED', 'Response', responseId, { score: input.score });
  revalidatePath('/teach/grading');
  revalidatePath(`/learn/results/${resp.attemptId}`);
  return { ok: true };
}
