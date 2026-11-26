'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createAssessment } from '@/lib/actions/assessments';
import type { AssessmentMode } from '@prisma/client';
import { Button, Card, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

const MODES: { value: AssessmentMode; label: string; hint: string }[] = [
  { value: 'REVIEWER', label: 'Reviewer', hint: 'Self-paced practice with hints, explanations, and repeat attempts.' },
  { value: 'QUIZ', label: 'Quiz', hint: 'Graded assessment with attempt limits, optional timer, and feedback release.' },
  { value: 'EXAM', label: 'Exam', hint: 'Graded assessment with a start/end window, time limit, and controlled release.' },
];

export function AssessmentForm() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<AssessmentMode>('QUIZ');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await createAssessment({
      title: String(fd.get('title') ?? ''),
      description: String(fd.get('description') ?? ''),
      mode,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed.');
      return;
    }
    toast('Assessment created');
    router.push(`/teach/assessments/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card className="space-y-4 p-5">
        <Field label="Title" htmlFor="title">
          <input id="title" name="title" required placeholder="e.g. Midterm Exam — Cell Biology" />
        </Field>
        <Field label="Description" htmlFor="description">
          <textarea id="description" name="description" rows={2} placeholder="Optional instructions for learners" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-900">Mode</legend>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${mode === m.value ? 'border-pine-900 bg-pine-50' : 'border-ink-400/20'}`}
              >
                <input type="radio" name="mode" className="mt-1" checked={mode === m.value} onChange={() => setMode(m.value)} />
                <span>
                  <span className="block text-sm font-medium text-ink-900">{m.label}</span>
                  <span className="block text-xs text-ink-600">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create draft'}</Button>
    </form>
  );
}
