'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Presentational primitives of the Shopping design. Markup and class names follow
 * docs/design/shopping/src/shopping.html; the rules live in shop-design.css and apply under `.shop-v2`.
 */

export type Tone = 'good' | 'warn' | 'bad' | '';
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | '';

export function Badge({ tone = '', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('badge', tone, className)}>{children}</span>;
}

/** Design button: `.button` with optional `primary` or `ghost` variant. */
export function DButton({ variant = '', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | '' }) {
  return <button type="button" className={cn('button', variant, className)} {...props} />;
}

/** Card with a head (title, copy, tools), body and optional footnote. */
export function Panel({ title, subtitle, icon, tools, children, footer, className, testId }: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tools?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('panel', className)} data-testid={testId}>
      <div className="panel-head">
        <div className="panel-titling">
          <h2>{icon}{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {tools ? <div className="panel-tools">{tools}</div> : null}
      </div>
      {children}
      {footer ? <div className="panel-foot">{footer}</div> : null}
    </section>
  );
}

export function RowList({ children }: { children: ReactNode }) {
  return <div className="rows" role="list">{children}</div>;
}

export function RowItem({ children, actions, testId }: { children: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <div className="rowitem" role="listitem" data-testid={testId}>
      <div className="row-main">{children}</div>
      {actions ? <div className="row-actions">{actions}</div> : null}
    </div>
  );
}

/** Empty, all-clear or celebratory state inside a panel. */
export function EmptyState({ title, children, tone = '', celebrate = false, icon }: {
  title?: string;
  children?: ReactNode;
  tone?: Tone;
  celebrate?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={cn('state', celebrate && 'celebrate')}>
      <div className="state-icon">{icon ?? (tone === 'good' || celebrate ? <Check className="size-5" /> : <Search className="size-5" />)}</div>
      {title ? <h3>{title}</h3> : null}
      {children ? <p>{children}</p> : null}
    </div>
  );
}

/** Retailer logo chip: short code from the name. */
export function ShopLogo({ name }: { name: string }) {
  const code = name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  return <span className="shop-logo" aria-hidden="true">{code}</span>;
}

/** Logo with the retailer name, one compact inline unit. */
export function PluginChip({ name, className }: { name: string; className?: string }) {
  return <span className={cn('plug', className)}><ShopLogo name={name} /><span className="plug-name">{name}</span></span>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function KpiTile({ label, value, foot, tone, onClick }: { label: string; value: number; foot: string; tone: Tone; onClick: () => void }) {
  return (
    <button type="button" className="kpi" onClick={onClick}>
      <span className="kpi-label">{label}</span>
      <span className={cn('kpi-value', tone)}>{value}</span>
      <span className="kpi-foot">{foot}</span>
    </button>
  );
}

export function StatusHero({ needsAttention, headline, copy, icon, children }: {
  needsAttention: boolean;
  headline: string;
  copy: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn('hero', needsAttention && 'needs')} aria-label="Shopping status">
      <div className="hero-main">
        <div className="hero-ring size-[62px]" aria-hidden="true">
          <span className={cn('rounded-full border', needsAttention ? 'border-[var(--shop-warning)] text-[var(--shop-warning)]' : 'border-[var(--shop-success)] text-[var(--shop-success)]')}>{icon}</span>
        </div>
        <div className="hero-copy">
          <h2>{headline}</h2>
          <p>{copy}</p>
        </div>
      </div>
      <div className="kpis">{children}</div>
    </section>
  );
}

/** Label/value rows. */
export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="kv">
      {rows.map(([label, value]) => <div key={label}><span>{label}</span><span>{value}</span></div>)}
    </div>
  );
}

/** Grid table on wide screens, labelled cards on narrow ones (the design CSS reads `data-label`). */
export function DataTable({ headers, cols, children }: { headers: string[]; cols?: string; children: ReactNode }) {
  const style = { '--cols': cols ?? `repeat(${headers.length}, minmax(0, 1fr))` } as CSSProperties;
  return (
    <div className="dtable" role="table" style={style}>
      <div className="dt-head" role="row">{headers.map(header => <span key={header} role="columnheader">{header}</span>)}</div>
      {children}
    </div>
  );
}

export function DataRow({ cells, testId }: { cells: Array<[string, ReactNode]>; testId?: string }) {
  return (
    <div className="dt-row" role="row" data-testid={testId}>
      {cells.map(([label, value]) => <span key={label} role="cell" data-label={label}>{value}</span>)}
    </div>
  );
}
