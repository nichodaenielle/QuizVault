'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gradeEssay } from '@/lib/actions/assessments';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';
import type { RubricCriterion } from '@/lib/questions';

export function GradeForm({
  responseId,
  maxScore,
  existing,
  rubric,
}: {
  responseId: string;
  maxScore: number;
  existing: { score: number; feedback: string; rubricScores: unknown } | null;
  rubric?: RubricCriterion[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [score, setScore] = useState(existing?.score ?? '');
  const [feedback, setFeedback] = useState(existing?.feedback ?? '');
  const [rubricScores, setRubricScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    const saved = existing?.rubricScores as Record<string, number> | null;
    rubric?.forEach((c) => {
      init[c.label] = saved?.[c.label] ?? 0;
    });
    return init;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await gradeEssay(responseId, {
      score: Number(score),
      maxScore,
      feedback,
      rubricScores: rubric?.length ? rubricScores : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed.');
      return;
    }
    toast('Grade saved');
    router.push('/teach/grading');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={`Score (0 – ${maxScore})`} htmlFor="score">
        <input
          id="score"
          type="number"
          min={0}
          max={maxScore}
          step={0.5}
          required
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </Field>
      {rubric && rubric.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-900">Rubric scores</legend>
          <div className="space-y-2">
            {rubric.map((c) => (
              <label key={c.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-900">
                  {c.label} <span className="text-xs text-ink-600">(max {c.maxPoints})</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={c.maxPoints}
                  step={0.5}
                  className="w-20"
                  value={rubricScores[c.label] ?? 0}
                  onChange={(e) => setRubricScores((s) => ({ ...s, [c.label]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field label="Feedback" htmlFor="feedback">
        <textarea id="feedback" rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Written feedback for the learner…" />
      </Field>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : existing ? 'Update grade' : 'Submit grade'}</Button>
    </form>
  );
}
