'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSet } from '@/lib/actions/sets';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export function CreateSetForm() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await createSet({ title: String(fd.get('title') ?? ''), description: String(fd.get('description') ?? '') });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed.');
      return;
    }
    toast('Set created');
    router.push(`/teach/sets/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Title" htmlFor="title">
        <input id="title" name="title" required placeholder="e.g. Cell biology basics" />
      </Field>
      <Field label="Description" htmlFor="description">
        <input id="description" name="description" placeholder="Optional" />
      </Field>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create set'}</Button>
    </form>
  );
}
