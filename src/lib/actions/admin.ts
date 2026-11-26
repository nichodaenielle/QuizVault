'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/access';
import type { Role } from '@prisma/client';
import type { ActionResult } from './sections';

export async function changeUserRole(userId: string, role: Role): Promise<ActionResult> {
  const actor = await requireRole('ADMIN');
  if (userId === actor.id) return { ok: false, error: 'You cannot change your own role.' };
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: 'User not found.' };
  if (target.role === role) return { ok: true };

  // Prevent demoting the last remaining admin.
  if (target.role === 'ADMIN' && role !== 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (admins <= 1) return { ok: false, error: 'Cannot demote the last admin.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role } });
    await tx.roleChange.create({
      data: { userId, fromRole: target.role, toRole: role, changedBy: actor.id },
    });
  });
  await audit(actor.id, 'ROLE_CHANGED', 'User', userId, { from: target.role, to: role });
  revalidatePath('/admin/users');
  return { ok: true };
}
