'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function QuestionFilters({
  subjects,
  current,
}: {
  subjects: string[];
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(current.q ?? '');
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  function apply(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    router.push(`/teach/questions?${sp.toString()}`);
  }

  function setParam(key: string, value: string) {
    apply({ ...currentRef.current, [key]: value || undefined });
  }

  // Debounced auto-search: typing applies after a short pause.
  useEffect(() => {
    const next = q.trim();
    if (next === (currentRef.current.q ?? '')) return;
    const t = setTimeout(() => {
      apply({ ...currentRef.current, q: next || undefined });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="min-w-48 flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-ink-600">Search</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Prompt or topic…" />
      </div>
      <div>
        <label htmlFor="type" className="mb-1 block text-xs font-medium text-ink-600">Type</label>
        <select id="type" value={current.type ?? ''} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">All types</option>
          <option value="TRUE_FALSE">True/False</option>
          <option value="MULTIPLE_CHOICE">Multiple choice</option>
          <option value="MULTIPLE_SELECT">Multiple select</option>
          <option value="SHORT_ANSWER">Short answer</option>
          <option value="IDENTIFICATION">Identification</option>
          <option value="ESSAY">Essay</option>
          <option value="ORDERING">Ordering</option>
        </select>
      </div>
      <div>
        <label htmlFor="difficulty" className="mb-1 block text-xs font-medium text-ink-600">Difficulty</label>
        <select id="difficulty" value={current.difficulty ?? ''} onChange={(e) => setParam('difficulty', e.target.value)}>
          <option value="">All</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>
      <div>
        <label htmlFor="subject" className="mb-1 block text-xs font-medium text-ink-600">Subject</label>
        <select id="subject" value={current.subject ?? ''} onChange={(e) => setParam('subject', e.target.value)}>
          <option value="">All</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="archived" className="mb-1 block text-xs font-medium text-ink-600">Status</label>
        <select id="archived" value={current.archived ?? ''} onChange={(e) => setParam('archived', e.target.value)}>
          <option value="">Active</option>
          <option value="all">All</option>
          <option value="1">Archived only</option>
        </select>
      </div>
      {params.toString() && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            router.push('/teach/questions');
          }}
          className="text-sm text-pine-900 hover:underline"
        >
          Clear
        </button>
      )}
    </form>
  );
}
