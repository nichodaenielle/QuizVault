'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteSet, setSetArchived } from '@/lib/actions/sets';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

export function SetRowActions({ id, archived = false }: { id: string; archived?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
        className="text-sm text-ink-600 hover:underline disabled:opacity-50"
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setDeleteError('');
          setDeleting(true);
        }}
        className="text-sm text-red-700 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
      <ConfirmDialog
        open={confirming}
        title={archived ? 'Restore question set' : 'Archive question set'}
        body={
          archived
            ? 'Restore this set? It becomes available for new assessments again.'
            : 'Archive this set? Assessments already published are unaffected.'
        }
        confirmLabel={archived ? 'Restore' : 'Archive'}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          await setSetArchived(id, !archived);
          setBusy(false);
          setConfirming(false);
          toast(archived ? 'Set restored' : 'Set archived');
          router.refresh();
        }}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        open={deleting}
        title="Delete question set"
        body="Permanently delete this set and its question list? Published assessments are unaffected (they use snapshots), but assessment drafts referencing it must be updated first. This cannot be undone."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          const res = await deleteSet(id);
          setBusy(false);
          if (!res.ok) {
            setDeleting(false);
            setDeleteError(res.error ?? 'Delete failed.');
            return;
          }
          setDeleting(false);
          toast('Set deleted');
          router.push('/teach/sets');
          router.refresh();
        }}
        onCancel={() => setDeleting(false)}
      />
      {deleteError && (
        <span role="alert" className="text-xs text-red-700">{deleteError}</span>
      )}
    </>
  );
}
