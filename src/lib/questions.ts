import type { QuestionType } from '@prisma/client';

// ---- Payload shapes stored in Question.payload / snapshot items ----

export interface McOption {
  id: string;
  text: string;
}

export interface RubricCriterion {
  label: string;
  maxPoints: number;
  description?: string;
}

export type QuestionPayload =
  | { correct: boolean; hint?: string } // TRUE_FALSE
  | { options: McOption[]; correctId: string; hint?: string } // MULTIPLE_CHOICE
  | { options: McOption[]; correctIds: string[]; partialCredit?: boolean; hint?: string } // MULTIPLE_SELECT
  | { answers: string[]; caseSensitive: boolean; hint?: string } // SHORT_ANSWER
  | { answers: string[]; caseSensitive: boolean; hint?: string } // IDENTIFICATION
  | { wordLimit?: number; rubric?: RubricCriterion[]; hint?: string } // ESSAY
  | { items: McOption[]; correctOrder: string[]; hint?: string }; // ORDERING — items[i].id order is the key

export interface SnapshotItem {
  key: string;
  refId?: string; // originating bank question id, when applicable
  type: QuestionType;
  prompt: string;
  points: number;
  payload: QuestionPayload;
  explanation?: string | null;
  topic?: string;
  subject?: string;
}

export interface FeedbackRelease {
  showScores: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  showFeedback: boolean;
  releaseAt?: string | null; // ISO time; scores hidden until then (after grading)
}

export const DEFAULT_RELEASE: FeedbackRelease = {
  showScores: true,
  showCorrectAnswers: false,
  showExplanations: false,
  showFeedback: true,
  releaseAt: null,
};

export interface AssessmentSettings {
  timeLimitSec?: number | null;
  attemptLimit?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
  feedbackRelease?: FeedbackRelease;
}

export interface Snapshot {
  mode: 'REVIEWER' | 'QUIZ' | 'EXAM';
  title: string;
  items: SnapshotItem[];
  settings: AssessmentSettings;
}

// ---- Answer shapes sent by the client ----

export type AnswerValue =
  | boolean
  | string
  | string[]
  | null
  | undefined;

export function normalizeText(s: string, caseSensitive: boolean) {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

/** Auto-grade an objective answer. Returns points earned or null if manual grading needed. */
export function autoGrade(
  type: QuestionType,
  payload: QuestionPayload,
  answer: AnswerValue,
  points: number,
): number | null {
  switch (type) {
    case 'TRUE_FALSE': {
      const p = payload as { correct: boolean };
      return answer === p.correct ? points : 0;
    }
    case 'MULTIPLE_CHOICE': {
      const p = payload as { correctId: string };
      return answer === p.correctId ? points : 0;
    }
    case 'MULTIPLE_SELECT': {
      const p = payload as { correctIds: string[]; partialCredit?: boolean };
      if (!Array.isArray(answer)) return 0;
      const a = new Set(answer);
      const c = new Set(p.correctIds);
      if (a.size === c.size && [...c].every((v) => a.has(v))) return points;
      if (!p.partialCredit || c.size === 0) return 0;
      // Partial credit: +1 per correct pick, −1 per wrong pick, scaled to points.
      let tp = 0;
      let fp = 0;
      for (const v of a) {
        if (c.has(v)) tp++;
        else fp++;
      }
      const earned = Math.max(0, tp - fp) / c.size;
      return Math.round(points * earned * 100) / 100;
    }
    case 'SHORT_ANSWER':
    case 'IDENTIFICATION': {
      const p = payload as { answers: string[]; caseSensitive: boolean };
      if (typeof answer !== 'string' || answer.trim() === '') return 0;
      const norm = normalizeText(answer, p.caseSensitive);
      return p.answers.some((a) => normalizeText(a, p.caseSensitive) === norm) ? points : 0;
    }
    case 'ORDERING': {
      const p = payload as { correctOrder?: string[] };
      const c = p.correctOrder ?? [];
      if (!Array.isArray(answer) || answer.length !== c.length) return 0;
      return answer.every((v, i) => v === c[i]) ? points : 0;
    }
    case 'ESSAY':
      return null; // manual grading
    default:
      return 0;
  }
}

export function isObjective(type: QuestionType) {
  return type !== 'ESSAY';
}

export function answerIsPresent(type: QuestionType, answer: AnswerValue): boolean {
  if (answer == null) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === 'boolean') return true;
  return false;
}

// ---- Validation ----

export function validatePayload(type: QuestionType, payload: unknown): string | null {
  const p = payload as QuestionPayload;
  if (!p || typeof p !== 'object') return 'Answer configuration is required.';
  switch (type) {
    case 'TRUE_FALSE':
      return typeof (p as { correct?: unknown }).correct === 'boolean' ? null : 'Choose the correct true/false value.';
    case 'MULTIPLE_CHOICE': {
      const mc = p as { options?: McOption[]; correctId?: string };
      if (!Array.isArray(mc.options) || mc.options.length < 2) return 'Multiple choice needs at least two options.';
      if (mc.options.some((o) => !o.id || !o.text?.trim())) return 'Every option needs text.';
      if (!mc.correctId || !mc.options.some((o) => o.id === mc.correctId)) return 'Select which option is correct.';
      return null;
    }
    case 'MULTIPLE_SELECT': {
      const ms = p as { options?: McOption[]; correctIds?: string[] };
      if (!Array.isArray(ms.options) || ms.options.length < 2) return 'Multiple select needs at least two options.';
      if (ms.options.some((o) => !o.id || !o.text?.trim())) return 'Every option needs text.';
      if (!Array.isArray(ms.correctIds) || ms.correctIds.length === 0) return 'Select at least one correct option.';
      if (ms.correctIds.some((id) => !ms.options!.some((o) => o.id === id))) return 'Correct options must exist in the option list.';
      return null;
    }
    case 'SHORT_ANSWER':
    case 'IDENTIFICATION': {
      const sa = p as { answers?: string[] };
      if (!Array.isArray(sa.answers) || sa.answers.filter((a) => a.trim()).length === 0)
        return 'Provide at least one acceptable answer.';
      return null;
    }
    case 'ORDERING': {
      const o = p as { items?: McOption[] };
      if (!Array.isArray(o.items) || o.items.length < 2) return 'Ordering needs at least two items.';
      if (o.items.some((i) => !i.id || !i.text?.trim())) return 'Every item needs text.';
      if (new Set(o.items.map((i) => i.id)).size !== o.items.length) return 'Item ids must be unique.';
      return null;
    }
    case 'ESSAY': {
      const es = p as { wordLimit?: number; rubric?: RubricCriterion[] };
      if (es.wordLimit != null && (!Number.isInteger(es.wordLimit) || es.wordLimit < 1))
        return 'Word limit must be a positive integer.';
      if (es.rubric) {
        for (const c of es.rubric) {
          if (!c.label?.trim()) return 'Every rubric criterion needs a label.';
          if (!Number.isFinite(c.maxPoints) || c.maxPoints < 0) return 'Rubric points must be zero or more.';
        }
      }
      return null;
    }
    default:
      return 'Unknown question type.';
  }
}
