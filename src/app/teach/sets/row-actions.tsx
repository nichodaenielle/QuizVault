'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setSetArchived } from '@/lib/actions/sets';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

export function SetRowActions({ id }: { id: string }) {
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
        Archive
      </button>
      <ConfirmDialog
        open={confirming}
        title="Archive question set"
        body="Archive this set? Assessments already published are unaffected."
        confirmLabel="Archive"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          await setSetArchived(id, true);
          setBusy(false);
          setConfirming(false);
          toast('Set archived');
          router.refresh();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
