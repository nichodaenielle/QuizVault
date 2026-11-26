'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

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

  function apply(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    router.push(`/teach/questions?${sp.toString()}`);
  }

  function setParam(key: string, value: string) {
    apply({ ...current, [key]: value || undefined });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ ...current, q: q || undefined });
      }}
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
      <button type="submit" className="rounded-lg bg-pine-900 px-4 py-2 text-sm font-medium text-ivory-50 hover:bg-pine-800">
        Search
      </button>
      {params.toString() && (
        <button type="button" onClick={() => router.push('/teach/questions')} className="text-sm text-pine-900 hover:underline">
          Clear
        </button>
      )}
    </form>
  );
}
