'use client';

import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  title: string;
}

/** Section tracker for manual pages: pill bar on mobile, sticky sidebar on lg+. */
export function ManualToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-15% 0px -75% 0px' },
    );
    for (const { id } of items) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(',')]);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  };

  const linkClass = (id: string) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
      active === id
        ? 'bg-pine-900 font-medium text-ivory-50'
        : 'text-ink-600 hover:bg-ink-400/10 hover:text-ink-900'
    }`;

  return (
    <>
      {/* Mobile: horizontal pill bar */}
      <nav
        aria-label="Manual sections"
        className="mb-6 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
      >
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={jump(item.id)} className={linkClass(item.id)}>
            {item.title}
          </a>
        ))}
      </nav>
      {/* Desktop: sticky sidebar */}
      <nav aria-label="Manual sections" className="hidden lg:block">
        <div className="sticky top-20">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-ink-500">On this page</p>
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} onClick={jump(item.id)} className={`block ${linkClass(item.id)}`}>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
