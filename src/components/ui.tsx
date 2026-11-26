import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const styles = {
    primary: 'bg-pine-900 text-ivory-50 hover:bg-pine-800 disabled:opacity-50',
    secondary: 'bg-pine-100 text-pine-900 hover:bg-pine-50 border border-pine-800/20',
    ghost: 'text-pine-900 hover:bg-pine-100',
    danger: 'bg-red-800 text-white hover:bg-red-700 disabled:opacity-50',
  }[variant];
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-pine-900 text-ivory-50 hover:bg-pine-800',
    secondary: 'bg-pine-100 text-pine-900 hover:bg-pine-50 border border-pine-800/20',
    ghost: 'text-pine-900 hover:bg-pine-100',
    danger: 'bg-red-800 text-white hover:bg-red-700',
  }[variant];
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-ink-400/15 bg-ivory-100 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'gold' | 'red' | 'blue';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-pine-50 text-pine-900 border-pine-800/20',
    green: 'bg-pine-800 text-ivory-50 border-pine-800',
    gold: 'bg-gold-100 text-gold-600 border-gold-500/40',
    red: 'bg-red-100 text-red-800 border-red-300',
    blue: 'bg-sky-100 text-sky-800 border-sky-300',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-900">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-600">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-400/30 bg-ivory-100/60 px-6 py-12 text-center">
      <p className="font-medium text-ink-900">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-600">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-400/15">
      <table className="w-full min-w-[640px] border-collapse bg-ivory-100 text-sm">
        <thead>
          <tr className="bg-pine-900 text-left text-ivory-50">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-400/10">{children}</tbody>
      </table>
    </div>
  );
}
