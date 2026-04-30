'use client';

import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

type BadgeTone = 'default' | 'success' | 'warning' | 'error' | 'accent';

const badgeToneClasses: Record<BadgeTone, string> = {
  default: 'bg-bg-3/60 text-text-2',
  success: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]',
  warning: 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]',
  error: 'bg-[var(--badge-error-bg)] text-[var(--badge-error-text)]',
  accent: 'bg-[var(--badge-accent-bg)] text-[var(--badge-accent-text)]',
};

export function AppCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn('rounded-xl border-border bg-card text-card-foreground shadow-none', className)}
      {...props}
    />
  );
}

export function AppCardSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AppCard className={className}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </AppCard>
  );
}

export function AppBadge({
  tone = 'default',
  small = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  small?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        small ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        badgeToneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AppStatusDot({
  status,
  className,
}: {
  status: 'success' | 'warning' | 'error' | 'idle';
  className?: string;
}) {
  const dotColor = {
    success: 'bg-[var(--badge-success-text)]',
    warning: 'bg-[var(--badge-warning-text)]',
    error: 'bg-[var(--badge-error-text)]',
    idle: 'bg-text-3',
  }[status];

  return <span className={cn('inline-block size-2 rounded-full', dotColor, className)} aria-hidden="true" />;
}

export function AppButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn('rounded-lg font-semibold', className)} {...props} />;
}

export function AppInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn('h-8 rounded-lg border-input bg-input/70 text-sm focus-visible:ring-2 focus-visible:ring-ring/60', className)}
      {...props}
    />
  );
}

export function AppSelect({ className, ...props }: React.ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect
      className={cn('h-8 rounded-lg border-input bg-input/70 text-sm focus-visible:ring-2 focus-visible:ring-ring/60', className)}
      {...props}
    />
  );
}

export function AppToggle({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border bg-bg-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
