'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  addQuestionsToSet,
  moveSetItem,
  removeSetItem,
  searchSetCandidates,
} from '@/lib/actions/sets';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { QuestionType } from '@prisma/client';

const TYPE_LABEL: Record<string, string> = {
  TRUE_FALSE: 'T/F',
  MULTIPLE_CHOICE: 'MC',
  MULTIPLE_SELECT: 'MS',
  SHORT_ANSWER: 'Short',
  IDENTIFICATION: 'ID',
  ESSAY: 'Essay',
};

interface Item {
  questionId: string;
  prompt: string;
  type: QuestionType;
  points: number;
  topic: string;
}

export function SetItemsEditor({ setId, items }: { setId: string; items: Item[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(questionId: string, dir: -1 | 1) {
    setBusy(true);
    await moveSetItem(setId, questionId, dir);
    setBusy(false);
    router.refresh();
  }

  async function remove(questionId: string) {
    setBusy(true);
    await removeSetItem(setId, questionId);
    setBusy(false);
    router.refresh();
  }

  // HTML5 drag-and-drop reorder: drop onto target swaps via two moves is complex;
  // simplest correct approach — move dragged item stepwise is server-bound.
  // Instead we implement drag to reorder by calling move repeatedly is fragile;
  // keyboard-accessible up/down buttons are the primary control (also satisfies a11y).
  function onDrop(targetId: string) {
    setDragId(null);
    setOverId(null);
    // Move dragged item adjacent to target using repeated moves.
    if (!dragId || dragId === targetId) return;
    const ids = items.map((i) => i.questionId);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    void (async () => {
      setBusy(true);
      const dir = to > from ? 1 : -1;
      const steps = Math.abs(to - from);
      for (let i = 0; i < steps; i++) {
        await moveSetItem(setId, dragId, dir);
      }
      setBusy(false);
      router.refresh();
    })();
  }

  return (
    <ol className="space-y-2">
      {items.map((item, idx) => (
        <li
          key={item.questionId}
          draggable
          onDragStart={() => setDragId(item.questionId)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(item.questionId);
          }}
          onDragLeave={() => setOverId((o) => (o === item.questionId ? null : o))}
          onDrop={() => onDrop(item.questionId)}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          className={cn(
            'flex items-start gap-3 rounded-lg border bg-ivory-50 p-3',
            overId === item.questionId && dragId !== item.questionId ? 'border-pine-800' : 'border-ink-400/20',
            dragId === item.questionId && 'opacity-50',
          )}
        >
          <span className="mt-1 w-6 shrink-0 text-center text-sm font-semibold text-ink-400">{idx + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm text-ink-900">{item.prompt}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{TYPE_LABEL[item.type] ?? item.type}</Badge>
              <Badge tone="green">{item.points} pts</Badge>
              <Badge tone="gold">{item.topic}</Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              disabled={busy || idx === 0}
              onClick={() => move(item.questionId, -1)}
              className="rounded border border-ink-400/30 px-2 py-0.5 text-xs text-ink-600 hover:bg-pine-50 disabled:opacity-40"
              aria-label={`Move question ${idx + 1} up`}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={busy || idx === items.length - 1}
              onClick={() => move(item.questionId, 1)}
              className="rounded border border-ink-400/30 px-2 py-0.5 text-xs text-ink-600 hover:bg-pine-50 disabled:opacity-40"
              aria-label={`Move question ${idx + 1} down`}
            >
              ↓
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(item.questionId)}
              className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
              aria-label={`Remove question ${idx + 1}`}
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

type Candidate = {
  id: string;
  prompt: string;
  type: QuestionType;
  subject: string;
  topic: string;
  points: number;
};

export function AddQuestionPicker({
  setId,
  candidates,
}: {
  setId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<{ q: string; rows: Candidate[] } | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(async () => {
      const id = ++reqId.current;
      const rows = await searchSetCandidates(setId, q);
      if (id === reqId.current) setSearch({ q, rows });
    }, 300);
    return () => clearTimeout(t);
  }, [query, setId]);

  const q = query.trim();
  const hasResults = !!search && search.q === q;
  const visible = q && hasResults ? search.rows : candidates;
  const searching = !!q && !hasResults;

  function toggle(id: string, checked: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  return (
    <div>
      <h2 className="mb-3 font-semibold text-ink-900">Add questions</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search prompt, topic, or subject…"
        aria-label="Search questions"
        className="mb-3 w-full rounded-lg border border-ink-400/30 bg-ivory-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-600/60 focus:border-pine-800 focus:outline-none focus:ring-2 focus:ring-pine-800/20"
      />
      {visible.length === 0 ? (
        <p className="text-sm text-ink-600">
          {searching ? 'Searching…' : hasResults && search.rows.length === 0 ? 'No matching questions.' : 'No more questions available. Create questions in the bank first.'}
        </p>
      ) : (
        <>
          <p className="mb-1 text-xs text-ink-600" aria-live="polite">
            {searching ? 'Searching…' : hasResults ? `${search.rows.length} result${search.rows.length === 1 ? '' : 's'}` : `${candidates.length} most recent`}
          </p>
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {visible.map((q) => (
              <li key={q.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-400/15 px-3 py-2 hover:bg-pine-50">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(q.id)}
                    onChange={(e) => toggle(q.id, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm text-ink-900">{q.prompt}</span>
                    <span className="text-xs text-ink-600">{q.subject} · {q.topic} · {q.points} pts</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className="mt-3"
            disabled={busy || selected.size === 0}
            onClick={async () => {
              setBusy(true);
              await addQuestionsToSet(setId, [...selected]);
              setSelected(new Set());
              setQuery('');
              setBusy(false);
              router.refresh();
            }}
          >
            {busy ? 'Adding…' : `Add ${selected.size || ''} selected`}
          </Button>
        </>
      )}
    </div>
  );
}
