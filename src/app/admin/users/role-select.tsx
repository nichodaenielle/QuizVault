'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { changeUserRole } from '@/lib/actions/admin';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Role } from '@prisma/client';

const ROLE_LABEL: Record<Role, string> = {
  LEARNER: 'Learner',
  INSTRUCTOR: 'Instructor',
  ADMIN: 'Admin',
};

export function RoleSelect({ userId, currentRole, isSelf }: { userId: string; currentRole: Role; isSelf: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  if (isSelf) return <span className="text-xs text-ink-400">You</span>;

  async function applyRole() {
    if (!pendingRole) return;
    setBusy(true);
    setError('');
    const res = await changeUserRole(userId, pendingRole);
    setBusy(false);
    setPendingRole(null);
    if (!res.ok) {
      setError(res.error ?? 'Failed.');
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <select
        key={currentRole}
        defaultValue={currentRole}
        disabled={busy}
        aria-label="Change role"
        className="w-32 py-1 text-xs"
        onChange={(e) => {
          const role = e.target.value as Role;
          e.target.value = currentRole;
          if (role === currentRole) return;
          setPendingRole(role);
        }}
      >
        <option value="LEARNER">Learner</option>
        <option value="INSTRUCTOR">Instructor</option>
        <option value="ADMIN">Admin</option>
      </select>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      <ConfirmDialog
        open={pendingRole !== null}
        title="Change user role"
        body={`Change this user's role to ${pendingRole ? ROLE_LABEL[pendingRole] : ''}? This takes effect immediately.`}
        confirmLabel="Change role"
        danger={false}
        busy={busy}
        onConfirm={() => void applyRole()}
        onCancel={() => setPendingRole(null)}
      />
    </span>
  );
}
