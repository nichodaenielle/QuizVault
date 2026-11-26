'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { acceptInvite } from '@/lib/actions/invites';
import { Button, Field } from '@/components/ui';

export function InviteAcceptForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await acceptInvite(token, {
      name: String(fd.get('name') ?? ''),
      details: String(fd.get('details') ?? ''),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not accept invite.');
      return;
    }
    router.push(res.redirect ?? '/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3">
      <Field label="Display name" htmlFor="name">
        <input id="name" name="name" defaultValue={defaultName} placeholder="Your name" />
      </Field>
      <Field label="Details (optional)" htmlFor="details" hint="e.g. student ID, program, or a short note.">
        <input id="details" name="details" placeholder="Optional" />
      </Field>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Accepting…' : 'Accept invite'}
      </Button>
    </form>
  );
}
