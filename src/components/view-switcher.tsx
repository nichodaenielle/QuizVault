'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Admin-only shortcut between the admin console and the instructor view. */
export function ViewSwitcher({ role }: { role: string }) {
  const pathname = usePathname();
  if (role !== 'ADMIN') return null;

  const target = pathname.startsWith('/teach')
    ? '/admin'
    : pathname.startsWith('/admin')
      ? '/teach'
      : null;
  if (!target) return null;

  return (
    <Link
      href={target}
      className="shrink-0 rounded-lg border border-gold-100/60 bg-gold-100/10 px-2.5 py-1 text-xs font-medium text-gold-100 hover:bg-gold-100/20 sm:px-3 sm:py-1.5 sm:text-sm"
    >
      {target === '/admin' ? 'Admin view' : 'Instructor view'}
    </Link>
  );
}
