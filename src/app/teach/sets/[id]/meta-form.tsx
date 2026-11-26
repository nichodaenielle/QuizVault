'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateSet } from '@/lib/actions/sets';
import { Button, Field } from '@/components/ui';

export function SetMetaForm({ setId, title, description }: { setId: string; title: string; description: string }) {
  const router = useRouter();
  const [t, setT] = useState(title);
  const [d, setD] = useState(description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const res = await updateSet(setId, { title: t, description: d });
        setBusy(false);
        if (!res.ok) setError(res.error ?? 'Failed.');
        else router.refresh();
      }}
    >
      <Field label="Title" htmlFor="set-title">
        <input id="set-title" value={t} onChange={(e) => setT(e.target.value)} required />
      </Field>
      <Field label="Description" htmlFor="set-desc">
        <input id="set-desc" value={d} onChange={(e) => setD(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
    </form>
  );
}
