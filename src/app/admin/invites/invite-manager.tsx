'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createInvite, listInvites, revokeInvite } from '@/lib/actions/invites';
import { Badge, Button, Field } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Role } from '@prisma/client';

type InviteRow = {
  id: string;
  token: string;
  email: string;
  role: Role | null;
  sectionName: string | null;
  invitedBy: string;
  acceptedBy: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
};

const STATUS_TONE: Record<string, 'green' | 'gold' | 'neutral'> = {
  PENDING: 'gold',
  ACCEPTED: 'green',
  EXPIRED: 'neutral',
};

export function InviteManager({
  initialInvites,
  isAdmin,
  sections,
}: {
  initialInvites: InviteRow[];
  isAdmin: boolean;
  sections: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [revoking, setRevoking] = useState<InviteRow | null>(null);

  async function refresh() {
    setInvites(await listInvites());
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await createInvite({
      email: String(fd.get('email') ?? ''),
      role: (fd.get('role') as Role) || '',
      sectionId: String(fd.get('sectionId') ?? '') || undefined,
      message: String(fd.get('message') ?? ''),
      expiresInDays: Number(fd.get('expiresInDays') ?? 7) || 7,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Failed to create invite.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    await refresh();
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={onSubmit} className="space-y-3 lg:col-span-1">
        <Field label="Invitee email" htmlFor="email">
          <input id="email" name="email" type="email" required placeholder="student@example.com" />
        </Field>
        {isAdmin && (
          <Field label="Role on accept" htmlFor="role" hint="Optional — grants this role when they accept.">
            <select id="role" name="role" defaultValue="">
              <option value="">No role change</option>
              <option value="LEARNER">Learner</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
        )}
        {sections.length > 0 && (
          <Field label="Enroll in section" htmlFor="sectionId" hint="Optional — joins this section on accept.">
            <select id="sectionId" name="sectionId" defaultValue="">
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Message" htmlFor="message" hint="Optional note shown on the invite page.">
          <input id="message" name="message" placeholder="e.g. Welcome to Biology 101" />
        </Field>
        <Field label="Link expires after (days)" htmlFor="expiresInDays">
          <input id="expiresInDays" name="expiresInDays" type="number" min={1} max={30} defaultValue={7} />
        </Field>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating…' : 'Create invite link'}
        </Button>
      </form>

      <div className="lg:col-span-2">
        <h2 className="mb-3 font-semibold text-ink-900">Invites</h2>
        {invites.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-400/30 bg-ivory-100/60 px-6 py-10 text-center text-sm text-ink-600">
            No invites yet. Create one to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="rounded-lg border border-ink-400/15 bg-ivory-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink-900">{inv.email}</span>
                  <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  {inv.role && <Badge tone="green">{inv.role}</Badge>}
                  {inv.sectionName && <Badge tone="gold">{inv.sectionName}</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-600">
                  From {inv.invitedBy}
                  {inv.acceptedBy ? ` · accepted by ${inv.acceptedBy}` : ''}
                </p>
                {inv.status === 'PENDING' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => copyLink(inv.token)}>
                      {copied === inv.token ? 'Copied!' : 'Copy link'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRevoking(inv)}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={revoking !== null}
        title="Revoke invite"
        body={`Revoke the invite for ${revoking?.email ?? ''}? The link will stop working.`}
        confirmLabel="Revoke"
        busy={busy}
        onConfirm={async () => {
          if (!revoking) return;
          setBusy(true);
          await revokeInvite(revoking.id);
          setBusy(false);
          setRevoking(null);
          await refresh();
        }}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}
