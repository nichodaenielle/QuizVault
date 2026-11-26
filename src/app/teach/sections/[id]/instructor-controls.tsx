'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { assignInstructor, removeInstructor } from '@/lib/actions/sections';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

export function InstructorControls({
  sectionId,
  userId,
  instructors,
  mode = 'remove',
  canRemove = true,
}: {
  sectionId: string;
  userId?: string;
  instructors?: { id: string; name: string | null; email: string }[];
  mode?: 'assign' | 'remove';
  canRemove?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (mode === 'assign') {
    return (
      <div className="mt-2 space-y-2">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="text-sm">
          <option value="">Assign instructor…</option>
          {(instructors ?? []).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name ?? i.email}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !selected}
          onClick={async () => {
            setBusy(true);
            setError('');
            const res = await assignInstructor(sectionId, selected);
            setBusy(false);
            if (!res.ok) setError(res.error ?? 'Failed.');
            else {
              setSelected('');
              toast('Instructor assigned');
              router.refresh();
            }
          }}
          className="w-full"
        >
          Assign
        </Button>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  if (!canRemove || !userId) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await removeInstructor(sectionId, userId);
        setBusy(false);
        toast('Instructor removed');
        router.refresh();
      }}
      className="text-xs text-red-700 hover:underline disabled:opacity-50"
      aria-label="Remove instructor"
    >
      {busy ? '…' : 'Remove'}
    </button>
  );
}
