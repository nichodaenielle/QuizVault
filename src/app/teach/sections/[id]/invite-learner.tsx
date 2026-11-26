'use client';

import { useState } from 'react';
import { createInvite } from '@/lib/actions/invites';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

export function InviteLearner({ sectionId, sectionName }: { sectionId: string; sectionName: string }) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setLink('');
    const target = email.trim();
    const res = await createInvite({ email: target, sectionId });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed.');
      return;
    }
    setLink(`${window.location.origin}${res.path}`);
    setLinkEmail(target);
    setEmail('');
    toast('Invite created — share the link below');
  }

  return (
    <div>
      <p className="mb-2 text-sm text-ink-600">
        Email a one-click invite that enrolls the learner in <strong>{sectionName}</strong>.
      </p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          aria-label="Invitee email"
          className="min-w-0 flex-1 rounded-lg border border-ink-400/30 bg-ivory-50 px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy} className="shrink-0">
          {busy ? '…' : 'Invite'}
        </Button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {link && (
        <div className="mt-3 rounded-lg border border-pine-800/20 bg-pine-50 p-3">
          <p className="mb-1 text-xs font-medium text-pine-900">Invite link ready — send it to {linkEmail}:</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-ink-900">{link}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded border border-pine-800/30 px-2 py-1 text-xs text-pine-900 hover:bg-pine-100"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
