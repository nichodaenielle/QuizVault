import Link from 'next/link';
import type { SessionUser } from '@/lib/auth';
import { ViewSwitcher } from './view-switcher';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="sticky top-0 z-40 bg-pine-900 text-ivory-50 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/QuizVault%20Logo%20Only.png"
              alt="QuizVault"
              className="h-9 w-9 rounded-lg bg-ivory-100 object-contain p-0.5"
            />
            QuizVault
          </Link>
          <nav
            aria-label="Main"
            className="ml-1 hidden min-w-0 flex-1 gap-0.5 overflow-x-auto px-1 xl:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-ivory-50/85 hover:bg-pine-800 hover:text-ivory-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ViewSwitcher role={user.role} />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ivory-50/80 lg:inline">
              {user.name ?? user.email}
              <span className="ml-1 rounded bg-pine-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-100">
                {user.role}
              </span>
            </span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-ivory-50/30 px-3 py-1.5 text-sm text-ivory-50 hover:bg-pine-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Main mobile"
          className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:hidden"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ivory-50/85 hover:bg-pine-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
