'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createQuestion, updateQuestion, type QuestionInput } from '@/lib/actions/questions';
import type { QuestionPayload, RubricCriterion } from '@/lib/questions';
import type { Difficulty, QuestionType } from '@prisma/client';
import { Button, Card, Field } from '@/components/ui';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/utils';

interface Props {
  initial?: {
    id: string;
    type: QuestionType;
    prompt: string;
    subject: string;
    topic: string;
    difficulty: Difficulty;
    points: number;
    payload: QuestionPayload;
    explanation: string | null;
    archived: boolean;
  };
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple select' },
  { value: 'SHORT_ANSWER', label: 'Typed short answer' },
  { value: 'IDENTIFICATION', label: 'Identification' },
  { value: 'ESSAY', label: 'Long essay' },
  { value: 'ORDERING', label: 'Ordering' },
];

export function QuestionForm({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'MEDIUM');
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [hint, setHint] = useState((initial?.payload as { hint?: string })?.hint ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const p = (initial?.payload ?? {}) as {
    options?: { id: string; text: string }[];
    correctId?: string;
    correctIds?: string[];
    partialCredit?: boolean;
    answers?: string[];
    caseSensitive?: boolean;
    wordLimit?: number;
    rubric?: RubricCriterion[];
    correct?: boolean;
    items?: { id: string; text: string }[];
    hint?: string;
  };
  const [tfCorrect, setTfCorrect] = useState<boolean>(p.correct === true);
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    p.options ?? [
      { id: crypto.randomUUID().slice(0, 8), text: '' },
      { id: crypto.randomUUID().slice(0, 8), text: '' },
    ],
  );
  const [mcCorrectId, setMcCorrectId] = useState<string>(p.correctId ?? '');
  const [msCorrectIds, setMsCorrectIds] = useState<string[]>(p.correctIds ?? []);
  const [msPartial, setMsPartial] = useState(p.partialCredit === true);
  const [answersText, setAnswersText] = useState<string>((p.answers ?? []).join('\n'));
  const [caseSensitive, setCaseSensitive] = useState(p.caseSensitive === true);
  const [wordLimit, setWordLimit] = useState<number | ''>(p.wordLimit ?? '');
  const [rubric, setRubric] = useState<RubricCriterion[]>(p.rubric ?? []);
  const [orderItems, setOrderItems] = useState<{ id: string; text: string }[]>(
    p.items ?? [
      { id: crypto.randomUUID().slice(0, 8), text: '' },
      { id: crypto.randomUUID().slice(0, 8), text: '' },
    ],
  );

  function payloadFor(t: QuestionType): unknown {
    switch (t) {
      case 'TRUE_FALSE':
        return { correct: tfCorrect, hint: hint || undefined };
      case 'MULTIPLE_CHOICE':
        return { options, correctId: mcCorrectId, hint: hint || undefined };
      case 'MULTIPLE_SELECT':
        return { options, correctIds: msCorrectIds, partialCredit: msPartial || undefined, hint: hint || undefined };
      case 'SHORT_ANSWER':
      case 'IDENTIFICATION':
        return {
          answers: answersText.split('\n').map((a) => a.trim()).filter(Boolean),
          caseSensitive,
          hint: hint || undefined,
        };
      case 'ESSAY':
        return {
          wordLimit: wordLimit === '' ? undefined : Number(wordLimit),
          rubric: rubric.length ? rubric : undefined,
          hint: hint || undefined,
        };
      case 'ORDERING':
        return { items: orderItems, hint: hint || undefined };
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const input: QuestionInput = {
      type,
      prompt,
      subject,
      topic,
      difficulty,
      points: Number(points),
      payload: payloadFor(type),
      explanation,
    };
    const res = initial ? await updateQuestion(initial.id, input) : await createQuestion(input);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Save failed.');
      return;
    }
    toast(initial ? 'Question updated' : 'Question created');
    router.push('/teach/questions');
    router.refresh();
  }

  const isMcMs = type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_SELECT';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="space-y-4 p-5">
        <Field label="Question type" htmlFor="type">
          <select id="type" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Prompt" htmlFor="prompt">
          <textarea id="prompt" required rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask the question…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Subject" htmlFor="subject">
            <input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" />
          </Field>
          <Field label="Topic" htmlFor="topic">
            <input id="topic" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cell division" />
          </Field>
          <Field label="Difficulty" htmlFor="difficulty">
            <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Points" htmlFor="points">
            <input id="points" type="number" min={0.5} step={0.5} required value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </Field>
          <Field label="Hint (optional)" htmlFor="hint">
            <input id="hint" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Shown in reviewer mode" />
          </Field>
        </div>
        <Field label="Explanation (optional)" htmlFor="explanation">
          <textarea id="explanation" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Shown after grading, per release rules" />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-ink-900">Answer key</h2>

        {type === 'TRUE_FALSE' && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-900">Correct answer</legend>
            <div className="flex gap-3">
              {[true, false].map((v) => (
                <label key={String(v)} className={cn('flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium', tfCorrect === v ? 'border-pine-900 bg-pine-900 text-ivory-50' : 'border-ink-400/30')}>
                  <input type="radio" name="tf" className="sr-only" checked={tfCorrect === v} onChange={() => setTfCorrect(v)} />
                  {v ? 'True' : 'False'}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {isMcMs && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink-900">
              {type === 'MULTIPLE_CHOICE' ? 'Options — select the correct one' : 'Options — select all correct ones'}
            </p>
            <ul className="space-y-2">
              {options.map((o, i) => {
                const isCorrect =
                  type === 'MULTIPLE_CHOICE' ? mcCorrectId === o.id : msCorrectIds.includes(o.id);
                return (
                  <li key={o.id} className="flex items-center gap-2">
                    <input
                      type={type === 'MULTIPLE_CHOICE' ? 'radio' : 'checkbox'}
                      name="correct-opt"
                      checked={isCorrect}
                      onChange={() => {
                        if (type === 'MULTIPLE_CHOICE') setMcCorrectId(o.id);
                        else
                          setMsCorrectIds((ids) =>
                            ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id],
                          );
                      }}
                      aria-label={`Mark option ${i + 1} as correct`}
                    />
                    <input
                      value={o.text}
                      onChange={(e) =>
                        setOptions((opts) => opts.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))
                      }
                      placeholder={`Option ${i + 1}`}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setOptions((opts) => opts.filter((x) => x.id !== o.id))}
                      className="text-sm text-red-700 hover:underline"
                      aria-label={`Remove option ${i + 1}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setOptions((opts) => [...opts, { id: crypto.randomUUID().slice(0, 8), text: '' }])
              }
            >
              + Add option
            </Button>
            {type === 'MULTIPLE_SELECT' && (
              <label className="flex items-start gap-2 pt-1 text-sm text-ink-900">
                <input type="checkbox" className="mt-1" checked={msPartial} onChange={(e) => setMsPartial(e.target.checked)} />
                <span>
                  Partial credit
                  <span className="block text-xs text-ink-600">
                    Off: any wrong or missing pick scores 0. On: +1 per correct pick, −1 per wrong pick, scaled to points.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        {(type === 'SHORT_ANSWER' || type === 'IDENTIFICATION') && (
          <div className="space-y-3">
            <Field
              label={type === 'IDENTIFICATION' ? 'Accepted answers / aliases (one per line)' : 'Accepted answers (one per line)'}
              htmlFor="answers"
            >
              <textarea id="answers" required rows={4} value={answersText} onChange={(e) => setAnswersText(e.target.value)} placeholder={'mitochondria\nmitochondrion'} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-900">
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
              Case-sensitive matching
            </label>
          </div>
        )}

        {type === 'ESSAY' && (
          <div className="space-y-4">
            <Field label="Word limit (optional)" htmlFor="wordLimit">
              <input id="wordLimit" type="number" min={1} value={wordLimit} onChange={(e) => setWordLimit(e.target.value === '' ? '' : Number(e.target.value))} placeholder="No limit" />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Rubric criteria (optional)</p>
              <ul className="space-y-2">
                {rubric.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-400/20 p-2">
                    <input
                      value={c.label}
                      onChange={(e) => setRubric((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      placeholder="Criterion"
                      className="min-w-40 flex-1"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={c.maxPoints}
                      onChange={(e) => setRubric((r) => r.map((x, j) => (j === i ? { ...x, maxPoints: Number(e.target.value) } : x)))}
                      className="w-24"
                      aria-label="Max points"
                    />
                    <input
                      value={c.description ?? ''}
                      onChange={(e) => setRubric((r) => r.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                      placeholder="Description"
                      className="min-w-40 flex-1"
                    />
                    <button type="button" onClick={() => setRubric((r) => r.filter((_, j) => j !== i))} className="text-sm text-red-700 hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                onClick={() => setRubric((r) => [...r, { label: '', maxPoints: 0 }])}
              >
                + Add criterion
              </Button>
            </div>
          </div>
        )}

        {type === 'ORDERING' && (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium text-ink-900">Items — list them in the correct order</p>
              <p className="mb-2 text-xs text-ink-600">Learners see these shuffled and must put them back in order. Wrong order scores 0.</p>
            </div>
            <ol className="space-y-2">
              {orderItems.map((o, i) => (
                <li key={o.id} className="flex items-center gap-2 rounded-lg border border-ink-400/20 p-2">
                  <span className="w-6 shrink-0 text-center text-sm font-semibold text-ink-400">{i + 1}.</span>
                  <input
                    value={o.text}
                    onChange={(e) =>
                      setOrderItems((items) => items.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))
                    }
                    placeholder={`Item ${i + 1}`}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() =>
                      setOrderItems((items) => {
                        const n = [...items];
                        [n[i - 1], n[i]] = [n[i], n[i - 1]];
                        return n;
                      })
                    }
                    className="rounded border border-ink-400/30 px-2 py-0.5 text-xs text-ink-600 hover:bg-pine-50 disabled:opacity-40"
                    aria-label={`Move item ${i + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === orderItems.length - 1}
                    onClick={() =>
                      setOrderItems((items) => {
                        const n = [...items];
                        [n[i], n[i + 1]] = [n[i + 1], n[i]];
                        return n;
                      })
                    }
                    className="rounded border border-ink-400/30 px-2 py-0.5 text-xs text-ink-600 hover:bg-pine-50 disabled:opacity-40"
                    aria-label={`Move item ${i + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderItems((items) => items.filter((x) => x.id !== o.id))}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setOrderItems((items) => [...items, { id: crypto.randomUUID().slice(0, 8), text: '' }])
              }
            >
              + Add item
            </Button>
          </div>
        )}
      </Card>

      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create question'}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/teach/questions')}>Cancel</Button>
      </div>
    </form>
  );
}
