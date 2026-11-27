import type { ReactNode } from 'react';

/** Numbered section wrapper for manual pages. */
export function ManualSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="mb-1 text-xl font-semibold text-ink-900">{title}</h2>
      <div className="mt-3 space-y-4 text-sm leading-6 text-ink-700">{children}</div>
    </section>
  );
}

/** Screenshot figure with optional numbered legend matching injected badges. */
export function Shot({
  src,
  alt,
  caption,
  legend,
}: {
  src: string;
  alt: string;
  caption?: string;
  legend?: string[];
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-ink-400/15 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/manual/img/${src}.png`} alt={alt} className="w-full" loading="lazy" />
      {(caption || legend) && (
        <figcaption className="border-t border-ink-400/10 px-4 py-3">
          {caption && <p className="text-sm text-ink-700">{caption}</p>}
          {legend && legend.length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-600">
              {legend.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** Horizontal step diagram with arrows (stacks vertically on mobile). */
export function Flow({ steps }: { steps: { title: string; body?: string }[] }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-2 sm:flex-1">
          <div className="w-full rounded-lg border border-ink-400/15 bg-white px-3 py-2.5 text-center shadow-sm">
            <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-pine-900 text-xs font-bold text-gold-500">
              {i + 1}
            </span>
            <p className="text-sm font-semibold text-ink-900">{s.title}</p>
            {s.body && <p className="mt-0.5 text-xs text-ink-600">{s.body}</p>}
          </div>
          {i < steps.length - 1 && (
            <>
              <span aria-hidden className="shrink-0 text-lg text-ink-400 sm:hidden">↓</span>
              <span aria-hidden className="hidden shrink-0 text-lg text-ink-400 sm:inline">→</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Small inline tip/callout box. */
export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gold-500/30 bg-gold-100/50 px-4 py-3 text-sm text-ink-700">
      {children}
    </div>
  );
}
