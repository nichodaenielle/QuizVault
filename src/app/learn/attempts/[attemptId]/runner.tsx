'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnswerValue, SnapshotItem } from '@/lib/questions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

interface Payload {
  attemptId: string;
  status: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  items: SnapshotItem[];
  responses: Record<string, AnswerValue>;
  flags: Record<string, boolean>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 1200;
const RETRY_MS = 10000;

export function Runner({
  payload,
  mode,
  title,
}: {
  payload: Payload;
  mode: 'REVIEWER' | 'QUIZ' | 'EXAM';
  title: string;
}) {
  const router = useRouter();
  const [items] = useState(payload.items);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(payload.responses ?? {});
  const [flags, setFlags] = useState<Record<string, boolean>>(payload.flags ?? {});
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [checkResults, setCheckResults] = useState<Record<string, { correct: boolean; score: number; maxScore: number }>>({});
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  const dirtyRef = useRef<Set<string>>(new Set());
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  const [hasDirty, setHasDirty] = useState(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const deadlineMs = payload.deadlineAt ? new Date(payload.deadlineAt).getTime() : null;

  const setAnswer = useCallback((key: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    dirtyRef.current.add(key);
    setHasDirty(true);
  }, []);

  const toggleFlag = useCallback(
    async (key: string) => {
      const next = !flags[key];
      setFlags((f) => {
        const nf = { ...f };
        if (next) nf[key] = true;
        else delete nf[key];
        return nf;
      });
      await fetch(`/api/attempts/${payload.attemptId}/flags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: key, flagged: next }),
      }).catch(() => {});
    },
    [flags, payload.attemptId],
  );

  const flush = useCallback(async () => {
    if (dirtyRef.current.size === 0 || submittedRef.current) return;
    const keys = [...dirtyRef.current];
    const batch: Record<string, AnswerValue> = {};
    for (const k of keys) batch[k] = answersRef.current[k];
    setSaveState('saving');
    try {
      const res = await fetch(`/api/attempts/${payload.attemptId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: batch }),
      });
      if (res.status === 410 || res.status === 409) {
        // Expired or submitted — finalize happened server-side.
        submittedRef.current = true;
        router.push(`/learn/results/${payload.attemptId}`);
        return;
      }
      if (!res.ok) throw new Error('save failed');
      for (const k of keys) dirtyRef.current.delete(k);
      if (dirtyRef.current.size === 0) setHasDirty(false);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [payload.attemptId, router]);

  // Debounced autosave.
  useEffect(() => {
    if (dirtyRef.current.size === 0) return;
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [answers, flush]);

  // Retry failed saves while dirty.
  useEffect(() => {
    if (saveState !== 'error') return;
    const t = setInterval(flush, RETRY_MS);
    return () => clearInterval(t);
  }, [saveState, flush]);

  // Flush on unload.
  useEffect(() => {
    const handler = () => {
      if (dirtyRef.current.size > 0 && !submittedRef.current) {
        const batch: Record<string, AnswerValue> = {};
        for (const k of dirtyRef.current) batch[k] = answersRef.current[k];
        navigator.sendBeacon(
          `/api/attempts/${payload.attemptId}/answers`,
          new Blob([JSON.stringify({ answers: batch })], { type: 'application/json' }),
        );
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [payload.attemptId]);

  // Timer.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainingMs = deadlineMs ? deadlineMs - now : null;
  const expired = remainingMs != null && remainingMs <= 0;

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    // Best-effort final flush.
    if (dirtyRef.current.size > 0) await flush().catch(() => {});
    try {
      const res = await fetch(`/api/attempts/${payload.attemptId}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error('submit failed');
      router.push(`/learn/results/${payload.attemptId}`);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError('Submission failed. Check your connection and try again.');
    }
  }, [flush, payload.attemptId, router]);

  // Auto-submit at deadline.
  useEffect(() => {
    if (expired && !submittedRef.current) {
      void doSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const answeredCount = useMemo(
    () => items.filter((i) => isAnswered(i, answers[i.key])).length,
    [items, answers],
  );
  const flaggedCount = Object.keys(flags).length;

  const item = items[current];

  async function checkAnswer() {
    if (!item) return;
    const res = await fetch(`/api/attempts/${payload.attemptId}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey: item.key, answer: answers[item.key] ?? null }),
    });
    if (res.ok) {
      const data = await res.json();
      setCheckResults((c) => ({ ...c, [item.key]: data }));
    }
  }

  return (
    <div className="min-h-screen bg-ivory-50">
      {/* Sticky header: title, timer, save status */}
      <header className="sticky top-0 z-40 border-b border-pine-800/20 bg-pine-900 text-ivory-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-xs text-ivory-50/70">
              Question {current + 1} of {items.length} · {answeredCount} answered
              {flaggedCount > 0 && ` · ${flaggedCount} flagged`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <SaveIndicator state={saveState} dirty={hasDirty} />
            {deadlineMs != null && (
              <span
                role="timer"
                aria-live="off"
                className={cn(
                  'rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tabular-nums',
                  expired ? 'bg-red-700' : remainingMs != null && remainingMs < 5 * 60_000 ? 'bg-gold-500 text-pine-950' : 'bg-pine-800',
                )}
              >
                {formatRemaining(remainingMs)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={submitting || expired}
              className="rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-semibold text-pine-950 hover:bg-gold-600 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </header>

      {submitError && (
        <div role="alert" className="mx-auto mt-4 max-w-6xl rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {submitError}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_260px]">
        {/* Question panel */}
        <section aria-label="Question" className="rounded-xl border border-ink-400/15 bg-ivory-100 p-5 shadow-sm sm:p-6">
          {item ? (
            <QuestionBody
              item={item}
              index={current}
              answer={answers[item.key]}
              onChange={(v) => setAnswer(item.key, v)}
              flagged={!!flags[item.key]}
              onToggleFlag={() => toggleFlag(item.key)}
              mode={mode}
              check={checkResults[item.key]}
              onCheck={checkAnswer}
              showExplanation={!!showExplanations[item.key]}
              onToggleExplanation={() =>
                setShowExplanations((s) => ({ ...s, [item.key]: !s[item.key] }))
              }
            />
          ) : (
            <p className="text-ink-600">No questions.</p>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-ink-400/15 pt-4">
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="rounded-lg border border-pine-800/30 px-4 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.min(items.length - 1, c + 1))}
              disabled={current === items.length - 1}
              className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-pine-800 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </section>

        {/* Navigator palette */}
        <aside aria-label="Question navigation" className="rounded-xl border border-ink-400/15 bg-ivory-100 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Questions</h2>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-4">
            {items.map((it, i) => {
              const answered = isAnswered(it, answers[it.key]);
              const flagged = !!flags[it.key];
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Question ${i + 1}${answered ? ', answered' : ', unanswered'}${flagged ? ', flagged' : ''}`}
                  aria-current={i === current ? 'true' : undefined}
                  className={cn(
                    'relative flex h-10 items-center justify-center rounded-lg border text-sm font-medium',
                    i === current
                      ? 'border-pine-900 bg-pine-900 text-ivory-50'
                      : answered
                        ? 'border-pine-800/50 bg-pine-100 text-pine-900'
                        : 'border-ink-400/30 bg-ivory-50 text-ink-600',
                  )}
                >
                  {i + 1}
                  {flagged && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold-500 text-[9px] font-bold text-pine-950" aria-hidden>
                      !
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-ink-600">
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-pine-800/50 bg-pine-100" /> Answered</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-ink-400/30 bg-ivory-50" /> Unanswered</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-gold-500" /> Flagged</li>
          </ul>
        </aside>
      </div>

      {/* Submit confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="w-full max-w-md rounded-xl bg-ivory-100 p-6 shadow-2xl">
            <h2 id="submit-title" className="text-lg font-semibold text-ink-900">Submit assessment?</h2>
            <p className="mt-2 text-sm text-ink-600">
              You have answered {answeredCount} of {items.length} questions
              {flaggedCount > 0 ? ` and flagged ${flaggedCount}` : ''}. You cannot change answers after submitting.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-pine-800/30 px-4 py-2 text-sm font-medium text-pine-900 hover:bg-pine-50"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); void doSubmit(); }}
                className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-pine-800"
              >
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isAnswered(item: SnapshotItem, answer: AnswerValue): boolean {
  if (answer == null) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  return typeof answer === 'boolean';
}

function formatRemaining(ms: number | null) {
  if (ms == null) return 'No limit';
  if (ms <= 0) return 'Time up';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function SaveIndicator({ state, dirty }: { state: SaveState; dirty: boolean }) {
  const label =
    state === 'saving' ? 'Saving…' : state === 'error' ? 'Save failed — retrying' : dirty ? 'Unsaved changes' : 'Saved';
  return (
    <span
      role="status"
      className={cn(
        'text-xs font-medium',
        state === 'error' ? 'text-red-300' : 'text-ivory-50/70',
      )}
    >
      {label}
    </span>
  );
}

function QuestionBody({
  item,
  index,
  answer,
  onChange,
  flagged,
  onToggleFlag,
  mode,
  check,
  onCheck,
  showExplanation,
  onToggleExplanation,
}: {
  item: SnapshotItem;
  index: number;
  answer: AnswerValue;
  onChange: (v: AnswerValue) => void;
  flagged: boolean;
  onToggleFlag: () => void;
  mode: string;
  check?: { correct: boolean; score: number; maxScore: number };
  onCheck: () => void;
  showExplanation: boolean;
  onToggleExplanation: () => void;
}) {
  const payload = item.payload as Record<string, unknown>;
  const isReviewer = mode === 'REVIEWER';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="green">{item.points} pt{item.points === 1 ? '' : 's'}</Badge>
          <Badge tone="neutral">{item.type.replace(/_/g, ' ')}</Badge>
          {item.topic && <Badge tone="gold">{item.topic}</Badge>}
        </div>
        <button
          type="button"
          onClick={onToggleFlag}
          aria-pressed={flagged}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium',
            flagged
              ? 'border-gold-500 bg-gold-100 text-gold-600'
              : 'border-ink-400/30 text-ink-600 hover:bg-pine-50',
          )}
        >
          {flagged ? '⚑ Flagged' : '⚑ Flag for review'}
        </button>
      </div>

      <h2 className="mt-4 text-lg font-medium leading-relaxed text-ink-900">
        <span className="mr-2 text-ink-400">{index + 1}.</span>
        {item.prompt}
      </h2>
      {typeof payload.hint === 'string' && payload.hint ? <p className="mt-2 text-sm text-ink-600">Hint: {payload.hint}</p> : null}

      <div className="mt-5">
        <AnswerInput item={item} answer={answer} onChange={onChange} />
      </div>

      {isReviewer && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCheck}
            className="rounded-lg border border-pine-800/40 px-3 py-1.5 text-sm font-medium text-pine-900 hover:bg-pine-50"
          >
            Check answer
          </button>
          {item.explanation && (
            <button
              type="button"
              onClick={onToggleExplanation}
              className="rounded-lg border border-ink-400/30 px-3 py-1.5 text-sm text-ink-600 hover:bg-pine-50"
            >
              {showExplanation ? 'Hide explanation' : 'Show explanation'}
            </button>
          )}
        </div>
      )}

      {check && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-lg px-3 py-2 text-sm font-medium',
            check.correct ? 'bg-pine-100 text-pine-900' : 'bg-gold-100 text-ink-900',
          )}
        >
          {check.correct ? `Correct — ${check.score}/${check.maxScore} pts` : `Not quite — 0/${check.maxScore} pts`}
        </p>
      )}
      {showExplanation && item.explanation && (
        <div className="mt-3 rounded-lg border border-gold-500/40 bg-gold-100/60 px-4 py-3 text-sm text-ink-900">
          <p className="font-semibold">Explanation</p>
          <p className="mt-1 whitespace-pre-wrap">{item.explanation}</p>
        </div>
      )}
    </div>
  );
}

function AnswerInput({
  item,
  answer,
  onChange,
}: {
  item: SnapshotItem;
  answer: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const payload = item.payload as Record<string, unknown>;
  const name = `q-${item.key}`;

  switch (item.type) {
    case 'TRUE_FALSE':
      return (
        <div className="flex gap-3" role="radiogroup" aria-label="True or false">
          {[
            { v: true, label: 'True' },
            { v: false, label: 'False' },
          ].map((o) => (
            <label
              key={String(o.v)}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium',
                answer === o.v ? 'border-pine-900 bg-pine-900 text-ivory-50' : 'border-ink-400/30 bg-ivory-50 hover:bg-pine-50',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={answer === o.v}
                onChange={() => onChange(o.v)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case 'MULTIPLE_CHOICE':
      return (
        <ul className="space-y-2" role="radiogroup" aria-label="Choose one answer">
          {(payload.options as { id: string; text: string }[]).map((o) => (
            <li key={o.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                  answer === o.id ? 'border-pine-900 bg-pine-100' : 'border-ink-400/30 bg-ivory-50 hover:bg-pine-50',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  className="mt-0.5"
                  checked={answer === o.id}
                  onChange={() => onChange(o.id)}
                />
                <span className="text-ink-900">{o.text}</span>
              </label>
            </li>
          ))}
        </ul>
      );
    case 'MULTIPLE_SELECT': {
      const selected = new Set(Array.isArray(answer) ? answer : []);
      return (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-600">Select all that apply</p>
          <ul className="space-y-2">
            {(payload.options as { id: string; text: string }[]).map((o) => {
              const checked = selected.has(o.id);
              return (
                <li key={o.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                      checked ? 'border-pine-900 bg-pine-100' : 'border-ink-400/30 bg-ivory-50 hover:bg-pine-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(o.id);
                        else next.delete(o.id);
                        onChange([...next]);
                      }}
                    />
                    <span className="text-ink-900">{o.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      );
    }
    case 'SHORT_ANSWER':
    case 'IDENTIFICATION':
      return (
        <input
          type="text"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={item.type === 'IDENTIFICATION' ? 'Type the term, person, place, or concept…' : 'Type your answer…'}
          autoComplete="off"
          className="max-w-xl"
        />
      );
    case 'ESSAY': {
      const text = typeof answer === 'string' ? answer : '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const limit = payload.wordLimit as number | undefined;
      return (
        <div>
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            placeholder="Write your answer…"
            className="w-full"
          />
          <p className={cn('mt-1 text-xs', limit && words > limit ? 'font-medium text-red-700' : 'text-ink-600')}>
            {words} word{words === 1 ? '' : 's'}
            {limit ? ` / ${limit} limit` : ''}
          </p>
        </div>
      );
    }
    default:
      return null;
  }
}
