'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setSetArchived } from '@/lib/actions/sets';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

export function SetRowActions({ id, archived = false }: { id: string; archived?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
    </>
  );
}
