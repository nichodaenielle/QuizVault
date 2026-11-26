'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSessionUser, homePathFor, requireRole } from '@/lib/auth';
import { audit, canManageSection } from '@/lib/access';
import type { ActionResult } from './sections';
import type { Prisma, Role } from '@prisma/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteInput {
  email: string;
  role?: Role | '';
  sectionId?: string;
  message?: string;
  expiresInDays?: number;
}

/** Create an email invite link. Instructors may attach a section; only admins may grant roles. */
export async function createInvite(
  input: InviteInput,
): Promise<ActionResult & { token?: string; path?: string }> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const email = input.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  let role: Role | null = null;
  if (input.role) {
    if (user.role !== 'ADMIN') return { ok: false, error: 'Only admins can invite with a role.' };
    if (input.role !== 'LEARNER' && input.role !== 'INSTRUCTOR') {
      return { ok: false, error: 'Invites can only grant Learner or Instructor roles.' };
    }
    role = input.role;
  }

  let sectionId: string | null = null;
  if (input.sectionId) {
    if (!(await canManageSection(user, input.sectionId))) {
      return { ok: false, error: 'You can only invite to sections you manage.' };
    }
    sectionId = input.sectionId;
  }
  if (!role && !sectionId) {
    return { ok: false, error: 'Choose a role or a section for this invite.' };
  }

  const days = Math.min(Math.max(input.expiresInDays ?? 7, 1), 30);
  const token = randomBytes(24).toString('base64url');
  const invite = await prisma.invite.create({
    data: {
      token,
      email,
      role,
      sectionId,
      message: input.message?.trim() || null,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    },
  });
  await audit(user.id, 'INVITE_CREATED', 'Invite', invite.id, { email, role, sectionId });
  revalidatePath('/admin/invites');
  revalidatePath('/teach/sections');
  return { ok: true, token, path: `/invite/${token}` };
}

export async function listInvites() {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const invites = await prisma.invite.findMany({
    where: user.role === 'ADMIN' ? {} : { invitedById: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      section: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
      acceptedBy: { select: { name: true, email: true } },
    },
  });
  const now = new Date();
  return invites.map((i) => ({
    id: i.id,
    token: i.token,
    email: i.email,
    role: i.role,
    sectionName: i.section?.name ?? null,
    message: i.message,
    invitedBy: i.invitedBy.name ?? i.invitedBy.email,
    acceptedBy: i.acceptedBy ? (i.acceptedBy.name ?? i.acceptedBy.email) : null,
    expiresAt: i.expiresAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    status: (i.acceptedAt ? 'ACCEPTED' : i.expiresAt < now ? 'EXPIRED' : 'PENDING') as
      | 'PENDING'
      | 'ACCEPTED'
      | 'EXPIRED',
  }));
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) return { ok: false, error: 'Invite not found.' };
  if (invite.acceptedAt) return { ok: false, error: 'Invite already accepted.' };
  if (user.role !== 'ADMIN' && invite.invitedById !== user.id) {
    return { ok: false, error: 'Access denied.' };
  }
  await prisma.invite.delete({ where: { id } });
  await audit(user.id, 'INVITE_REVOKED', 'Invite', id);
  revalidatePath('/admin/invites');
  revalidatePath('/teach/sections');
  return { ok: true };
}

/** Accept an invite: applies role/section grants and stores profile details. */
export async function acceptInvite(
  token: string,
  input: { name?: string; details?: string },
): Promise<ActionResult & { redirect?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) return { ok: false, error: 'Invite not found.' };
  if (invite.acceptedAt) return { ok: false, error: 'This invite was already used.' };
  if (invite.expiresAt < new Date()) return { ok: false, error: 'This invite has expired.' };
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: `This invite was sent to ${invite.email}. Sign in with that Google account.` };
  }

  const name = input.name?.trim();
  const details = input.details?.trim();
  let finalRole = user.role;
  // Invites may only raise a role, never lower it (e.g. an instructor
  // accepting a learner invite must not be demoted).
  const ROLE_RANK: Record<Role, number> = { LEARNER: 0, INSTRUCTOR: 1, ADMIN: 2 };
  const grantRole = invite.role && ROLE_RANK[invite.role] > ROLE_RANK[user.role] ? invite.role : null;

  await prisma.$transaction(async (tx) => {
    const data: Prisma.UserUpdateInput = {};
    if (name) data.name = name;
    if (details !== undefined) data.details = details || null;
    if (grantRole) {
      await tx.roleChange.create({
        data: { userId: user.id, fromRole: user.role, toRole: grantRole, changedBy: invite.invitedById },
      });
      data.role = grantRole;
      finalRole = grantRole;
    }
    if (Object.keys(data).length) {
      await tx.user.update({ where: { id: user.id }, data });
    }
    if (invite.sectionId) {
      await tx.enrollment.upsert({
        where: { sectionId_userId: { sectionId: invite.sectionId, userId: user.id } },
        create: { sectionId: invite.sectionId, userId: user.id, enrolledBy: invite.invitedById },
        update: {},
      });
    }
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    });
  });

  await audit(user.id, 'INVITE_ACCEPTED', 'Invite', invite.id, { role: invite.role, sectionId: invite.sectionId });
  revalidatePath('/learn');
  revalidatePath('/teach/sections');
  return { ok: true, redirect: homePathFor(finalRole) };
}
