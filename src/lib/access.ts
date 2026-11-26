import { prisma } from './prisma';
import type { Prisma, Role } from '@prisma/client';
import type { SessionUser } from './auth';

export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  meta?: unknown,
  tx?: Prisma.TransactionClient,
) {
  await (tx ?? prisma).auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      meta: meta === undefined ? undefined : (meta as object),
    },
  });
}

/** Sections an instructor is assigned to (admins see all via callers). */
export async function instructorSectionIds(userId: string) {
  const rows = await prisma.sectionInstructor.findMany({
    where: { userId },
    select: { sectionId: true },
  });
  return rows.map((r) => r.sectionId);
}

export async function isInstructorOf(userId: string, sectionId: string) {
  const found = await prisma.sectionInstructor.findUnique({
    where: { sectionId_userId: { sectionId, userId } },
  });
  return !!found;
}

/** True if the user may manage this section (admin or assigned instructor). */
export async function canManageSection(user: SessionUser, sectionId: string) {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'INSTRUCTOR') return false;
  return isInstructorOf(user.id, sectionId);
}

export async function requireSectionManager(user: SessionUser, sectionId: string) {
  if (!(await canManageSection(user, sectionId))) {
    throw new Error('You do not have access to this section.');
  }
}

/** Sections a learner is enrolled in. */
export async function learnerSectionIds(userId: string) {
  const rows = await prisma.enrollment.findMany({
    where: { userId },
    select: { sectionId: true },
  });
  return rows.map((r) => r.sectionId);
}

export async function isEnrolled(userId: string, sectionId: string) {
  const found = await prisma.enrollment.findUnique({
    where: { sectionId_userId: { sectionId, userId } },
  });
  return !!found;
}

export async function listInstructors() {
  return prisma.user.findMany({
    where: { role: { in: ['INSTRUCTOR', 'ADMIN'] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
}

export function hasRole(user: { role: Role }, ...roles: Role[]) {
  return roles.includes(user.role);
}
