'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/access';
import type { ActionResult } from './sections';

async function ownedSet(id: string, userId: string, isAdmin: boolean) {
  const set = await prisma.questionSet.findUnique({ where: { id }, include: { items: true } });
  if (!set) return null;
  if (!isAdmin && set.ownerId !== userId) return null;
  return set;
}

export async function createSet(input: { title: string; description?: string }): Promise<ActionResult & { id?: string }> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Set title is required.' };
  const set = await prisma.questionSet.create({
    data: { ownerId: user.id, title, description: input.description?.trim() || null },
  });
  await audit(user.id, 'SET_CREATED', 'QuestionSet', set.id);
  revalidatePath('/teach/sets');
  return { ok: true, id: set.id };
}

export async function updateSet(id: string, input: { title: string; description?: string }): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const set = await ownedSet(id, user.id, user.role === 'ADMIN');
  if (!set) return { ok: false, error: 'Set not found.' };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Set title is required.' };
  await prisma.questionSet.update({
    where: { id },
    data: { title, description: input.description?.trim() || null },
  });
  revalidatePath('/teach/sets');
  return { ok: true };
}

export async function setSetArchived(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const set = await ownedSet(id, user.id, user.role === 'ADMIN');
  if (!set) return { ok: false, error: 'Set not found.' };
  await prisma.questionSet.update({ where: { id }, data: { archived } });
  revalidatePath('/teach/sets');
  return { ok: true };
}

/** Search bank questions that can still be added to a set. */
export async function searchSetCandidates(
  setId: string,
  query: string,
): Promise<{ id: string; prompt: string; type: import('@prisma/client').QuestionType; subject: string; topic: string; points: number }[]> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const set = await ownedSet(setId, user.id, user.role === 'ADMIN');
  if (!set) return [];
  const q = query.trim();
  return prisma.question.findMany({
    where: {
      archived: false,
      ...(user.role === 'INSTRUCTOR' ? { ownerId: user.id } : {}),
      id: { notIn: set.items.map((i) => i.questionId) },
      ...(q
        ? {
            OR: [
              { prompt: { contains: q, mode: 'insensitive' as const } },
              { topic: { contains: q, mode: 'insensitive' as const } },
              { subject: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, prompt: true, type: true, subject: true, topic: true, points: true },
  });
}

export async function addQuestionsToSet(setId: string, questionIds: string[]): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const set = await ownedSet(setId, user.id, user.role === 'ADMIN');
  if (!set) return { ok: false, error: 'Set not found.' };
  const maxOrder = set.items.reduce((m, i) => Math.max(m, i.order), -1);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true },
  });
  const existing = new Set(set.items.map((i) => i.questionId));
  let order = maxOrder;
  await prisma.$transaction(
    questions
      .filter((q) => !existing.has(q.id))
      .map((q) =>
        prisma.questionSetItem.create({
          data: { setId, questionId: q.id, order: ++order },
        }),
      ),
  );
  revalidatePath(`/teach/sets/${setId}`);
  return { ok: true };
}

export async function removeSetItem(setId: string, questionId: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const set = await ownedSet(setId, user.id, user.role === 'ADMIN');
  if (!set) return { ok: false, error: 'Set not found.' };
  await prisma.questionSetItem.delete({
    where: { setId_questionId: { setId, questionId } },
  });
  revalidatePath(`/teach/sets/${setId}`);
  return { ok: true };
}

/** Move an item up (-1) or down (+1). Keyboard-accessible ordering. */
export async function moveSetItem(setId: string, questionId: string, dir: -1 | 1): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const set = await ownedSet(setId, user.id, user.role === 'ADMIN');
  if (!set) return { ok: false, error: 'Set not found.' };
  const items = [...set.items].sort((a, b) => a.order - b.order);
  const idx = items.findIndex((i) => i.questionId === questionId);
  const swapIdx = idx + dir;
  if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return { ok: true };
  const a = items[idx];
  const b = items[swapIdx];
  await prisma.$transaction([
    prisma.questionSetItem.update({ where: { setId_questionId: { setId, questionId: a.questionId } }, data: { order: b.order } }),
    prisma.questionSetItem.update({ where: { setId_questionId: { setId, questionId: b.questionId } }, data: { order: a.order } }),
  ]);
  revalidatePath(`/teach/sets/${setId}`);
  return { ok: true };
}
