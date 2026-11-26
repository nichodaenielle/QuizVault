'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { joinSection } from '@/lib/actions/sections';
import { Button, Card, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export function JoinForm() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await joinSection(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not join.');
      return;
    }
    toast('Joined the section');
    router.push('/learn');
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Class code" htmlFor="code" error={error} hint="Codes are 8 characters, e.g. ABCD2345.">
          <input
            id="code"
            name="code"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={12}
            placeholder="Enter class code"
            className="text-center font-mono text-lg tracking-widest"
          />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Joining…' : 'Join section'}
        </Button>
      </form>
    </Card>
  );
}
