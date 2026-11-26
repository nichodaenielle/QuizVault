'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { audit, requireSectionManager } from '@/lib/access';
import { joinWithCode, rotateCode, setCodeStatus } from '@/lib/codes';
import type { CodeStatus } from '@prisma/client';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function joinSection(formData: FormData): Promise<ActionResult> {
  const user = await requireRole('LEARNER', 'INSTRUCTOR', 'ADMIN');
  const code = String(formData.get('code') ?? '');
  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const result = await joinWithCode(code, user.id, ip);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/learn');
  return { ok: true };
}

export async function createSection(formData: FormData): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const instructorIds = formData.getAll('instructorIds').map(String).filter(Boolean);

  if (!name) return { ok: false, error: 'Section name is required.' };
  if (user.role === 'INSTRUCTOR' && instructorIds.some((id) => id !== user.id)) {
    return { ok: false, error: 'Instructors can only assign themselves.' };
  }

  const section = await prisma.$transaction(async (tx) => {
    const s = await tx.section.create({
      data: { name, description: description || null, createdById: user.id },
    });
    const ids = user.role === 'INSTRUCTOR' ? [user.id] : instructorIds.length ? instructorIds : [user.id];
    // Only staff may be section instructors — ignore anything else.
    const staff = await tx.user.findMany({
      where: { id: { in: ids }, role: { in: ['INSTRUCTOR', 'ADMIN'] } },
      select: { id: true },
    });
    const staffIds = staff.length ? staff.map((u) => u.id) : [user.id];
    await tx.sectionInstructor.createMany({
      data: staffIds.map((uid) => ({ sectionId: s.id, userId: uid, assignedBy: user.id })),
      skipDuplicates: true,
    });
    // Generate the first join code inside the transaction.
    const { generateCode } = await import('@/lib/utils');
    let joinCode = generateCode(8);
    for (let i = 0; i < 10; i++) {
      const exists = await tx.sectionCode.findUnique({ where: { code: joinCode } });
      if (!exists) break;
      joinCode = generateCode(8);
    }
    await tx.sectionCode.create({
      data: { sectionId: s.id, code: joinCode, status: 'ACTIVE', createdBy: user.id },
    });
    return s;
  });

  await audit(user.id, 'SECTION_CREATED', 'Section', section.id, { name });
  revalidatePath('/teach');
  revalidatePath('/admin');
  return { ok: true };
}

export async function rotateSectionCode(sectionId: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  await requireSectionManager(user, sectionId);
  await rotateCode(sectionId, user.id);
  await audit(user.id, 'CODE_ROTATED', 'Section', sectionId);
  revalidatePath(`/teach/sections/${sectionId}`);
  revalidatePath(`/admin/sections/${sectionId}`);
  return { ok: true };
}

export async function updateCodeStatus(
  codeId: string,
  sectionId: string,
  status: 'ACTIVE' | 'DISABLED' | 'EXPIRED',
): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  await requireSectionManager(user, sectionId);
  const target = await prisma.sectionCode.findUnique({ where: { id: codeId } });
  if (!target || target.sectionId !== sectionId) {
    return { ok: false, error: 'Code not found in this section.' };
  }
  if (status === 'ACTIVE') {
    // Re-activating: disable other active codes for the section.
    await prisma.$transaction(async (tx) => {
      await tx.sectionCode.updateMany({
        where: { sectionId, status: 'ACTIVE', id: { not: codeId } },
        data: { status: 'DISABLED', disabledAt: new Date() },
      });
      await tx.sectionCode.update({ where: { id: codeId }, data: { status: 'ACTIVE', disabledAt: null } });
    });
  } else {
    await setCodeStatus(codeId, status as CodeStatus);
  }
  await audit(user.id, `CODE_${status}`, 'Section', sectionId, { codeId });
  revalidatePath(`/teach/sections/${sectionId}`);
  revalidatePath(`/admin/sections/${sectionId}`);
  return { ok: true };
}

export async function expireSectionCode(codeId: string, sectionId: string) {
  return updateCodeStatus(codeId, sectionId, 'EXPIRED');
}

export async function assignInstructor(sectionId: string, userId: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  if (user.role === 'INSTRUCTOR') {
    if (userId !== user.id) return { ok: false, error: 'Instructors can only assign themselves.' };
  }
  await requireSectionManager(user, sectionId);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || (target.role !== 'INSTRUCTOR' && target.role !== 'ADMIN')) {
    return { ok: false, error: 'User must be an instructor or admin.' };
  }
  await prisma.sectionInstructor.upsert({
    where: { sectionId_userId: { sectionId, userId } },
    update: {},
    create: { sectionId, userId, assignedBy: user.id },
  });
  await audit(user.id, 'INSTRUCTOR_ASSIGNED', 'Section', sectionId, { userId });
  revalidatePath(`/teach/sections/${sectionId}`);
  revalidatePath(`/admin/sections/${sectionId}`);
  return { ok: true };
}

export async function removeEnrollment(sectionId: string, userId: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  await requireSectionManager(user, sectionId);
  await prisma.enrollment.deleteMany({ where: { sectionId, userId } });
  await audit(user.id, 'LEARNER_REMOVED', 'Section', sectionId, { userId });
  revalidatePath(`/teach/sections/${sectionId}`);
  return { ok: true };
}

export async function removeInstructor(sectionId: string, userId: string): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  if (user.role === 'INSTRUCTOR' && userId !== user.id) {
    return { ok: false, error: 'Instructors can only remove themselves.' };
  }
  await requireSectionManager(user, sectionId);
  await prisma.sectionInstructor.deleteMany({ where: { sectionId, userId } });
  await audit(user.id, 'INSTRUCTOR_REMOVED', 'Section', sectionId, { userId });
  revalidatePath(`/teach/sections/${sectionId}`);
  return { ok: true };
}

export async function updateSection(
  sectionId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole('INSTRUCTOR', 'ADMIN');
  await requireSectionManager(user, sectionId);
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!name) return { ok: false, error: 'Section name is required.' };
  await prisma.section.update({
    where: { id: sectionId },
    data: { name, description: description || null },
  });
  revalidatePath(`/teach/sections/${sectionId}`);
  revalidatePath(`/admin/sections/${sectionId}`);
  return { ok: true };
}
