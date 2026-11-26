import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { AppShell } from '@/components/shell';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { auditWhere, auditInclude, auditFilterOptions } from '@/lib/activity';
import { formatDateTime } from '@/lib/time';
import { ActivityFilters } from './activity-filters';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole('ADMIN');
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const filters = {
    q: pick('q'),
    action: pick('action'),
    entity: pick('entity'),
    actor: pick('actor'),
    from: pick('from'),
    to: pick('to'),
  };

  const where = auditWhere(filters);
  const page = Math.max(1, parseInt(pick('page') ?? '1', 10) || 1);

  const [logs, total, options] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: auditInclude(),
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    auditFilterOptions(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) exportParams.set(k, v);
  const exportHref = `/api/admin/activity${exportParams.size ? `?${exportParams}` : ''}`;

  function pageHref(p: number) {
    const params = new URLSearchParams(exportParams);
    if (p > 1) params.set('page', String(p));
    return `/admin/activity${params.size ? `?${params}` : ''}`;
  }

  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/users', label: 'Users & roles' },
        { href: '/admin/sections', label: 'Sections' },
        { href: '/admin/invites', label: 'Invites' },
        { href: '/admin/activity', label: 'Activity' },
      ]}
    >
      <PageHeader
        title="Activity log"
        subtitle={`${total.toLocaleString()} entr${total === 1 ? 'y' : 'ies'} · every audited action across the platform.`}
        actions={
          <a
            href={exportHref}
            className="inline-flex items-center rounded-lg border border-ink-400/20 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:bg-ink-400/5"
          >
            Download .txt
          </a>
        }
      />

      <Card className="mb-6 p-4">
        <ActivityFilters
          actions={options.actions}
          entities={options.entities}
          actors={options.actors}
          current={filters}
        />
      </Card>

      {logs.length === 0 ? (
        <EmptyState title="No activity found" body="Try widening the filters or date range." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-400/15 text-left text-xs uppercase tracking-wide text-ink-600">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-ink-400/10 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{formatDateTime(l.createdAt, user.timezone)}</td>
                  <td className="px-4 py-2.5 text-ink-900">{l.actor ? (l.actor.name ?? l.actor.email) : 'System'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="neutral">{l.action.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-900">
                    {l.entity}
                    <span className="ml-1 font-mono text-xs text-ink-600">{l.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="max-w-64 truncate px-4 py-2.5 font-mono text-xs text-ink-600" title={l.meta ? JSON.stringify(l.meta) : ''}>
                    {l.meta ? JSON.stringify(l.meta) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-600">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={pageHref(page - 1)} className="rounded-lg border border-ink-400/20 bg-white px-3 py-1.5 hover:bg-ink-400/5">Previous</a>
            )}
            {page < pages && (
              <a href={pageHref(page + 1)} className="rounded-lg border border-ink-400/20 bg-white px-3 py-1.5 hover:bg-ink-400/5">Next</a>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
