'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rotateSectionCode, updateCodeStatus } from '@/lib/actions/sections';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

interface CodeRow {
  id: string;
  code: string;
  status: string;
  expiresAt: string | null;
}

export function CodeControls({ sectionId, codes }: { sectionId: string; codes: CodeRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    <div className="space-y-2">
      {codes.length > 0 && (
        <ul className="space-y-1 text-xs">
          {codes.slice(0, 5).map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded border border-ink-400/15 px-2 py-1">
              <span className="font-mono">{c.code}</span>
              <span className="flex items-center gap-1">
                <span className={`font-medium ${c.status === 'ACTIVE' ? 'text-pine-800' : 'text-ink-400'}`}>{c.status}</span>
                {c.status !== 'ACTIVE' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => updateCodeStatus(c.id, sectionId, 'ACTIVE'), 'Code reactivated')}
                    className="text-pine-900 hover:underline"
                  >
                    reactivate
                  </button>
                )}
                {c.status === 'ACTIVE' && (
                  <>
                    <button type="button" disabled={busy} onClick={() => act(() => updateCodeStatus(c.id, sectionId, 'DISABLED'), 'Code disabled')} className="text-ink-600 hover:underline">
                      disable
                    </button>
                    <button type="button" disabled={busy} onClick={() => act(() => updateCodeStatus(c.id, sectionId, 'EXPIRED'), 'Code expired')} className="text-red-700 hover:underline">
                      expire
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => act(() => rotateSectionCode(sectionId), 'New class code generated')}
        className="w-full"
      >
        {busy ? 'Working…' : 'Rotate / generate new code'}
      </Button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
