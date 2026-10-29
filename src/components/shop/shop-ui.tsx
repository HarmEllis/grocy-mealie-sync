'use client';

import type { ReactNode } from 'react';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'good' | 'warn' | 'bad' | 'none';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-[var(--badge-success-text)]',
  warn: 'text-[var(--badge-warning-text)]',
  bad: 'text-[var(--badge-error-text)]',
  none: 'text-text-1',
};

/** Card with a header (title, optional copy and tools) and a body. */
export function Panel({ title, subtitle, icon, tools, children, footer, className }: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 overflow-hidden rounded-xl border border-border bg-bg-1', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 md:px-5">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-bold text-text-1">{icon}{title}</h2>
          {subtitle ? <p className="max-w-3xl text-xs text-text-2">{subtitle}</p> : null}
        </div>
        {tools ? <div className="flex flex-wrap items-center gap-2">{tools}</div> : null}
      </header>
      {children}
      {footer ? <footer className="flex items-start gap-2 border-t border-border px-4 py-3 text-xs text-text-2 md:px-5">{footer}</footer> : null}
    </section>
  );
}

/** Divided list of decision rows. */
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border border-t border-border">{children}</ul>;
}

export function RowItem({ children, actions, testId }: { children: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 text-sm md:flex-row md:items-start md:justify-between md:px-5" data-testid={testId}>
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:max-w-[55%] md:justify-end">{actions}</div> : null}
    </li>
  );
}

/** Empty or all-clear state shown inside a panel. */
export function EmptyState({ title, children, tone = 'none' }: { title?: string; children?: ReactNode; tone?: Tone }) {
  return (
    <div className="border-t border-border px-4 py-6 text-center md:px-5">
      {title ? <p className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{title}</p> : null}
      {children ? <p className="mx-auto mt-1 max-w-xl text-xs text-text-2">{children}</p> : null}
    </div>
  );
}

/** Retailer logo chip: short code plus name, always one compact inline unit. */
export function PluginChip({ name, className }: { name: string; className?: string }) {
  const code = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-text-2', className)}>
      <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-md border border-border bg-bg-2 font-mono text-[9px] font-semibold text-text-1">{code}</span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden="true" />;
}

export function KpiTile({ label, value, foot, tone, onClick }: { label: string; value: number; foot: string; tone: Tone; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col gap-0.5 border-border px-4 py-3 text-left transition-colors hover:bg-bg-2 focus-visible:outline-2 focus-visible:outline-primary max-md:border-b md:border-l md:first:border-l-0">
      <span className="text-[10px] font-bold tracking-wider text-text-2 uppercase">{label}</span>
      <span className={cn('font-mono text-2xl font-semibold', TONE_TEXT[tone])}>{value}</span>
      <span className="text-[11px] text-text-3">{foot}</span>
    </button>
  );
}

export function StatusHero({ needsAttention, headline, copy, children }: {
  needsAttention: boolean;
  headline: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <section aria-label="Shopping status" className="overflow-hidden rounded-xl border border-border bg-bg-1">
      <div className="flex items-start gap-4 border-l-4 px-4 py-4 md:px-5" style={{ borderLeftColor: needsAttention ? 'var(--badge-warning-text)' : 'var(--accent)' }}>
        <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-full border', needsAttention ? 'border-[var(--badge-warning-text)]/50 bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]' : 'border-[var(--badge-success-text)]/50 bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]')}>
          {needsAttention ? <TriangleAlert className="size-5" /> : <Check className="size-5" />}
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-text-1">{headline}</h2>
          <p className="max-w-3xl text-xs text-text-2">{copy}</p>
        </div>
      </div>
      <div className="grid border-t border-border sm:grid-cols-2 md:grid-cols-5">{children}</div>
    </section>
  );
}

/** Label/value rows that stay readable on narrow screens. */
export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="space-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="text-text-2">{label}</dt>
          <dd className="min-w-0 text-right font-mono text-text-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Grid table on wide screens, labelled cards below md. */
export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div role="table" className="border-t border-border text-sm">
      <div role="row" className="hidden bg-bg-1 px-5 py-2 text-[10px] font-bold tracking-wider text-text-2 uppercase md:grid md:grid-cols-[var(--cols)] md:gap-3" style={{ '--cols': `repeat(${headers.length}, minmax(0, 1fr))` } as React.CSSProperties}>
        {headers.map(header => <span key={header} role="columnheader">{header}</span>)}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export function DataRow({ cells, columns, testId }: { cells: Array<[string, ReactNode]>; columns: number; testId?: string }) {
  return (
    <div role="row" data-testid={testId} className="grid gap-1 px-4 py-3 md:grid-cols-[var(--cols)] md:items-center md:gap-3 md:px-5" style={{ '--cols': `repeat(${columns}, minmax(0, 1fr))` } as React.CSSProperties}>
      {cells.map(([label, value]) => (
        <div key={label} role="cell" className="min-w-0 break-words">
          <span className="block text-[10px] font-bold tracking-wider text-text-3 uppercase md:hidden">{label}</span>
          {value}
        </div>
      ))}
    </div>
  );
}
