'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DevLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login(role: 'LEARNER' | 'INSTRUCTOR' | 'ADMIN', suffix: string) {
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${role.toLowerCase()}${suffix}@dev.local`,
        name: `${role[0]}${role.slice(1).toLowerCase()} ${suffix || 'User'}`,
        role,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(data.redirect);
      router.refresh();
    } else {
      setError('Dev sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-ink-400/20 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
        Development sign-in (DEV_AUTH=1)
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => login('LEARNER', '')}
          className="rounded-lg border border-pine-800/30 px-2 py-2 text-xs font-medium text-pine-900 hover:bg-pine-50 disabled:opacity-50"
        >
          Learner
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => login('INSTRUCTOR', '')}
          className="rounded-lg border border-pine-800/30 px-2 py-2 text-xs font-medium text-pine-900 hover:bg-pine-50 disabled:opacity-50"
        >
          Instructor
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => login('ADMIN', '')}
          className="rounded-lg border border-pine-800/30 px-2 py-2 text-xs font-medium text-pine-900 hover:bg-pine-50 disabled:opacity-50"
        >
          Admin
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
