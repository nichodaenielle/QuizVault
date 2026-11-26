'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSection } from '@/lib/actions/sections';
import { Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export function CreateSectionForm({
  instructors,
  isAdmin,
}: {
  instructors: { id: string; name: string | null; email: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await createSection(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed to create section.');
      return;
    }
    toast('Section created');
    router.push('/teach/sections');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Section name" htmlFor="name">
        <input id="name" name="name" required placeholder="e.g. BSCS 3-A" />
      </Field>
      <Field label="Description" htmlFor="description">
        <input id="description" name="description" placeholder="Optional" />
      </Field>
      {isAdmin && instructors.length > 0 && (
        <Field label="Assign instructors" htmlFor="instructorIds">
          <select id="instructorIds" name="instructorIds" multiple size={Math.min(5, instructors.length)} className="h-auto">
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name ?? i.email} ({i.email})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-600">Hold Ctrl/Cmd to select multiple.</p>
        </Field>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Creating…' : 'Create section'}
      </Button>
    </form>
  );
}
