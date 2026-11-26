'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteAssessment, setAssessmentStatus } from '@/lib/actions/assessments';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

export function AssessmentRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(true);
    setError('');
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Action failed.');
    else toast(done);
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <a href={`/teach/assessments/${id}`} className="text-sm font-medium text-pine-900 hover:underline">
        Open
      </a>
      {status === 'PUBLISHED' && (
        <button type="button" disabled={busy} onClick={() => act(() => setAssessmentStatus(id, 'CLOSED'), 'Assessment closed')} className="text-sm text-ink-600 hover:underline">
          Close
        </button>
      )}
      {status === 'CLOSED' && (
        <button type="button" disabled={busy} onClick={() => act(() => setAssessmentStatus(id, 'PUBLISHED'), 'Assessment reopened')} className="text-sm text-pine-900 hover:underline">
          Reopen
        </button>
      )}
      {status === 'DRAFT' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmingDelete(true)}
          className="text-sm text-red-700 hover:underline"
        >
          Delete
        </button>
      )}
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete draft assessment"
        body="This permanently deletes the draft. This cannot be undone."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={() => {
          setConfirmingDelete(false);
          void act(() => deleteAssessment(id), 'Assessment deleted');
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </span>
  );
}
