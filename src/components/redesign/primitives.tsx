'use client';

import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
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
      className={cn(
        'rounded-2xl border-[var(--card-border)] bg-[var(--card-bg)] text-card-foreground',
        'backdrop-blur-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)]',
        className,
      )}
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
  pulse = false,
  className,
}: {
  status: 'success' | 'warning' | 'error' | 'idle';
  pulse?: boolean;
  className?: string;
}) {
  const dotColor = {
    success: 'bg-[var(--badge-success-text)]',
    warning: 'bg-[var(--badge-warning-text)]',
    error: 'bg-[var(--badge-error-text)]',
    idle: 'bg-text-3',
  }[status];

  return (
    <span className={cn('relative inline-flex size-2.5 items-center justify-center', className)} aria-hidden="true">
      {pulse ? (
        <span
          className={cn('absolute inline-block size-2 rounded-full opacity-40', dotColor)}
          style={{ animation: 'pulseRing 2s ease-out infinite' }}
        />
      ) : null}
      <span className={cn('inline-block size-2 rounded-full', dotColor)} />
    </span>
  );
}

export function AppButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'rounded-[10px] border-white/10 bg-white/6 font-semibold text-text-1 transition-all duration-150',
        'hover:-translate-y-0.5 hover:bg-white/10',
        'data-[variant=default]:hover:shadow-[0_0_24px_var(--accent-glow),0_4px_16px_color-mix(in_oklab,var(--accent)_30%,transparent)]',
        className,
      )}
      {...props}
    />
  );
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
          checked
            ? 'border-primary bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--accent)_40%,transparent)]'
            : 'border-border bg-bg-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full transition-transform',
            checked ? 'bg-[#060b14]' : 'bg-white/70',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function ProgressRing({
  value,
  max,
  size = 48,
  color,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  size?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const dash = pct * circumference;
  const stroke = color ?? 'var(--accent)';

  return (
    <div className="flex min-w-[72px] flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text
          x="24"
          y="28"
          textAnchor="middle"
          fill={stroke}
          fontSize="10"
          fontWeight="700"
          fontFamily="var(--font-mono)"
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label ? <span className="text-xs font-semibold text-text-1">{label}</span> : null}
      {sublabel ? <span className="text-[11px] text-text-3">{sublabel}</span> : null}
    </div>
  );
}

export function AnimatedCounter({
  value,
  duration = 800,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const target = useMemo(() => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0), [value]);

  useEffect(() => {
    const startAt = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(ease * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration, target]);

  return <span className={className}>{displayValue}</span>;
}
