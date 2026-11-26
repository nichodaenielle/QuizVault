'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function ActivityFilters({
  actions,
  entities,
  actors,
  current,
}: {
  actions: string[];
  entities: string[];
  actors: { id: string; name: string | null; email: string }[];
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
    router.push(`/admin/activity?${sp.toString()}`);
  }

  function setParam(key: string, value: string) {
    apply({ ...currentRef.current, [key]: value || undefined });
  }

  useEffect(() => {
    const next = q.trim();
    if (next === (currentRef.current.q ?? '')) return;
    const t = setTimeout(() => {
      apply({ ...currentRef.current, q: next || undefined });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const label = 'mb-1 block text-xs font-medium text-ink-600';

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
      <div className="min-w-48 flex-1">
        <label htmlFor="q" className={label}>Search</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action, entity, actor…" />
      </div>
      <div>
        <label htmlFor="action" className={label}>Action</label>
        <select id="action" value={current.action ?? ''} onChange={(e) => setParam('action', e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="entity" className={label}>Entity</label>
        <select id="entity" value={current.entity ?? ''} onChange={(e) => setParam('entity', e.target.value)}>
          <option value="">All entities</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="actor" className={label}>Actor</label>
        <select id="actor" value={current.actor ?? ''} onChange={(e) => setParam('actor', e.target.value)}>
          <option value="">Everyone</option>
          {actors.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.email}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="from" className={label}>From</label>
        <input id="from" type="date" value={current.from ?? ''} onChange={(e) => setParam('from', e.target.value)} />
      </div>
      <div>
        <label htmlFor="to" className={label}>To</label>
        <input id="to" type="date" value={current.to ?? ''} onChange={(e) => setParam('to', e.target.value)} />
      </div>
      {params.toString() && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            router.push('/admin/activity');
          }}
          className="text-sm text-pine-900 hover:underline"
        >
          Clear
        </button>
      )}
    </form>
  );
}
