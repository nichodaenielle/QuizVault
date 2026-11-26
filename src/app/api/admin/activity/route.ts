import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditWhere, auditInclude } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 10000;

/** Download the filtered audit log as a plain-text file (admin only). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const where = auditWhere({
    q: sp.get('q') ?? undefined,
    action: sp.get('action') ?? undefined,
    entity: sp.get('entity') ?? undefined,
    actor: sp.get('actor') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
  });

  const logs = await prisma.auditLog.findMany({
    where,
    include: auditInclude(),
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });

  const lines = [
    `QuizVault audit log export`,
    `Generated: ${new Date().toISOString()}`,
    `Filters: ${JSON.stringify(Object.fromEntries(sp.entries()))}`,
    `Entries: ${logs.length}${logs.length === MAX_ROWS ? ' (capped at 10000)' : ''}`,
    '',
    ...logs.map((l) => {
      const actor = l.actor ? (l.actor.name ?? l.actor.email) : 'System';
      const meta = l.meta ? ` | ${JSON.stringify(l.meta)}` : '';
      return `${l.createdAt.toISOString()} | ${actor} | ${l.action} | ${l.entity} ${l.entityId}${meta}`;
    }),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${stamp}.txt"`,
    },
  });
}
