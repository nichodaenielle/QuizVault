'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/access';
import { validatePayload, type McOption, type QuestionPayload, type RubricCriterion } from '@/lib/questions';
import type { Difficulty, QuestionType } from '@prisma/client';
import type { ActionResult } from './sections';

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  points: number;
  payload: unknown;
  explanation?: string;
}

function hintOf(p: Record<string, unknown>) {
  return typeof p.hint === 'string' && p.hint.trim() ? p.hint.trim() : undefined;
}

function normalizePayload(type: QuestionType, raw: unknown): QuestionPayload | null {
  const p = raw as Record<string, unknown>;
  if (!p || typeof p !== 'object') return null;
  const optId = () => crypto.randomUUID().slice(0, 8);
  switch (type) {
    case 'TRUE_FALSE':
      return { correct: p.correct === true, hint: hintOf(p) };
    case 'MULTIPLE_CHOICE': {
      const options: McOption[] = (Array.isArray(p.options) ? p.options : [])
        .map((o) => ({ id: String((o as McOption).id || optId()), text: String((o as McOption).text ?? '').trim() }))
        .filter((o) => o.text);
      const correctId = String(p.correctId ?? '');
      return { options, correctId, hint: hintOf(p) };
    }
    case 'MULTIPLE_SELECT': {
      const options: McOption[] = (Array.isArray(p.options) ? p.options : [])
        .map((o) => ({ id: String((o as McOption).id || optId()), text: String((o as McOption).text ?? '').trim() }))
        .filter((o) => o.text);
      const correctIds = Array.isArray(p.correctIds) ? p.correctIds.map(String) : [];
      return { options, correctIds, hint: hintOf(p) };
    }
    case 'SHORT_ANSWER':
    case 'IDENTIFICATION':
      return {
        answers: (Array.isArray(p.answers) ? p.answers : []).map((a) => String(a).trim()).filter(Boolean),
        caseSensitive: p.caseSensitive === true,
        hint: hintOf(p),
      };
    case 'ESSAY': {
      const rubric = Array.isArray(p.rubric)
        ? (p.rubric as RubricCriterion[])
            .map((c) => ({
              label: String(c.label ?? '').trim(),
              maxPoints: Number(c.maxPoints ?? 0),
              description: c.description ? String(c.description).trim() : undefined,
            }))
            .filter((c) => c.label)
        : undefined;
      return {
        wordLimit: p.wordLimit != null && p.wordLimit !== '' ? Number(p.wordLimit) : undefined,
        rubric: rubric && rubric.length ? rubric : undefined,
        hint: hintOf(p),
      };
    }
    default:
      return null;
  }
}

function validateInput(input: QuestionInput): string | null {
  if (!input.prompt?.trim()) return 'Question prompt is required.';
  if (!input.subject?.trim()) return 'Subject is required.';
  if (!input.topic?.trim()) return 'Topic is required.';
  if (!Number.isFinite(input.points) || input.points <= 0) return 'Points must be greater than zero.';
  const payload = normalizePayload(input.type, input.payload);
  if (!payload) return 'Invalid answer configuration.';
  return validatePayload(input.type, payload);
}

export async function createQuestion(input: QuestionInput): Promise<ActionResult & { id?: string }> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const err = validateInput(input);
  if (err) return { ok: false, error: err };
  const payload = normalizePayload(input.type, input.payload)!;
  const q = await prisma.question.create({
    data: {
      ownerId: user.id,
      type: input.type,
      prompt: input.prompt.trim(),
      subject: input.subject.trim(),
      topic: input.topic.trim(),
      difficulty: input.difficulty,
      points: input.points,
      payload: payload as object,
      explanation: input.explanation?.trim() || null,
    },
  });
  await audit(user.id, 'QUESTION_CREATED', 'Question', q.id);
  revalidatePath('/teach/questions');
  return { ok: true, id: q.id };
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: 'Question not found.' };
  if (user.role === 'INSTRUCTOR' && existing.ownerId !== user.id) {
    return { ok: false, error: 'You can only edit your own questions.' };
  }
  const err = validateInput(input);
  if (err) return { ok: false, error: err };
  const payload = normalizePayload(input.type, input.payload)!;
  await prisma.question.update({
    where: { id },
    data: {
      type: input.type,
      prompt: input.prompt.trim(),
      subject: input.subject.trim(),
      topic: input.topic.trim(),
      difficulty: input.difficulty,
      points: input.points,
      payload: payload as object,
      explanation: input.explanation?.trim() || null,
      version: { increment: 1 },
    },
  });
  await audit(user.id, 'QUESTION_UPDATED', 'Question', id);
  revalidatePath('/teach/questions');
  return { ok: true };
}

export async function setQuestionArchived(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return { ok: false, error: 'Question not found.' };
  if (user.role === 'INSTRUCTOR' && q.ownerId !== user.id) {
    return { ok: false, error: 'You can only modify your own questions.' };
  }
  await prisma.question.update({ where: { id }, data: { archived } });
  await audit(user.id, archived ? 'QUESTION_ARCHIVED' : 'QUESTION_RESTORED', 'Question', id);
  revalidatePath('/teach/questions');
  return { ok: true };
}

export async function duplicateQuestion(id: string): Promise<ActionResult & { id?: string }> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return { ok: false, error: 'Question not found.' };
  const copy = await prisma.question.create({
    data: {
      ownerId: user.id,
      type: q.type,
      prompt: q.prompt,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      points: q.points,
      payload: q.payload as object,
      explanation: q.explanation,
    },
  });
  await audit(user.id, 'QUESTION_DUPLICATED', 'Question', id, { copyId: copy.id });
  revalidatePath('/teach/questions');
  return { ok: true, id: copy.id };
}
