'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { duplicateQuestion, setQuestionArchived } from '@/lib/actions/questions';

export function QuestionRowActions({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await duplicateQuestion(id);
          setBusy(false);
          router.refresh();
        }}
        className="text-sm text-pine-900 hover:underline disabled:opacity-50"
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await setQuestionArchived(id, !archived);
          setBusy(false);
          router.refresh();
        }}
        className="text-sm text-ink-600 hover:underline disabled:opacity-50"
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
    </span>
  );
}
