import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export interface ActivityFilterParams {
  q?: string;
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
}

/** Build the AuditLog where clause from URL-style filter params. */
export function auditWhere(p: ActivityFilterParams): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (p.action) where.action = p.action;
  if (p.entity) where.entity = p.entity;
  if (p.actor) where.actorId = p.actor;

  if (p.from || p.to) {
    where.createdAt = {};
    const from = p.from ? new Date(`${p.from}T00:00:00`) : null;
    const to = p.to ? new Date(`${p.to}T23:59:59.999`) : null;
    if (from && !isNaN(from.getTime())) where.createdAt.gte = from;
    if (to && !isNaN(to.getTime())) where.createdAt.lte = to;
    if (!where.createdAt.gte && !where.createdAt.lte) delete where.createdAt;
  }

  const q = p.q?.trim();
  if (q) {
    where.OR = [
      { action: { contains: q, mode: 'insensitive' } },
      { entity: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q, mode: 'insensitive' } },
      { actor: { name: { contains: q, mode: 'insensitive' } } },
      { actor: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }

  return where;
}

export function auditInclude() {
  return { actor: { select: { name: true, email: true } } } as const;
}

/** Distinct filter options for the activity page dropdowns. */
export async function auditFilterOptions() {
  const [actions, entities, actorIds] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } }),
    prisma.auditLog.groupBy({ by: ['actorId'], where: { actorId: { not: null } }, _count: true, orderBy: { _count: { actorId: 'desc' } }, take: 100 }),
  ]);
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds.map((a) => a.actorId!).filter(Boolean) } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  return {
    actions: actions.map((a) => a.action),
    entities: entities.map((e) => e.entity),
    actors,
  };
}
