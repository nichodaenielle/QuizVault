'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { removeEnrollment } from '@/lib/actions/sections';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

export function RosterControls({ sectionId, userId }: { sectionId: string; userId: string }) {
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
        className="text-sm text-red-700 hover:underline disabled:opacity-50"
      >
        {busy ? '…' : 'Remove'}
      </button>
      <ConfirmDialog
        open={confirming}
        title="Remove learner"
        body="Remove this learner from the section? Their past attempts are preserved."
        confirmLabel="Remove"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          await removeEnrollment(sectionId, userId);
          setBusy(false);
          setConfirming(false);
          toast('Learner removed from section');
          router.refresh();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
