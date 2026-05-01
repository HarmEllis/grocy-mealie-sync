'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, History, LayoutDashboard, Link2, Moon, Server, Settings2, Sun } from 'lucide-react';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { AppVersion } from '@/components/app/AppVersion';
import { AppStatusDot } from '@/components/redesign/primitives';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { type AccentMode, useThemePreferences } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

interface ShellStatus {
  lastGrocyPoll: string | null;
  lastMealiePoll: string | null;
  schedulerStatus?: 'active' | 'passive_startup_lock' | 'inactive';
}

interface AppShellProps {
  children: React.ReactNode;
  authEnabled: boolean;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/mapping', label: 'Product Mapping', icon: Link2 },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

const ACCENT_OPTIONS = [
  { value: 'amber', label: 'Amber' },
  { value: 'teal', label: 'Teal' },
  { value: 'violet', label: 'Violet' },
] as const;

const STATUS_POLL_MS = 60_000;

function formatShortDate(value: string | null): string {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function pageTitle(pathname: string): string {
  if (pathname === '/mapping') {
    return 'Product Mapping';
  }

  if (pathname.startsWith('/history')) {
    return 'History';
  }

  if (pathname === '/settings') {
    return 'Settings';
  }

  if (pathname === '/api-endpoints') {
    return 'API Endpoints';
  }

  return 'Dashboard';
}

function navActive(currentPath: string, href: string): boolean {
  if (href === '/') {
    return currentPath === '/';
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AppShell({ children, authEnabled }: AppShellProps) {
  const pathname = usePathname();
  const { theme, setTheme, accent, setAccent } = useThemePreferences();
  const [status, setStatus] = useState<ShellStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('failed status fetch');
        }

        const data = await response.json() as ShellStatus;
        setStatus(data);
        setStatusError(false);
      } catch {
        setStatusError(true);
      }
    }

    void loadStatus();
    const interval = window.setInterval(loadStatus, STATUS_POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const lastSeen = useMemo(() => {
    const timestamps = [status?.lastGrocyPoll, status?.lastMealiePoll].filter((value): value is string => Boolean(value));
    if (timestamps.length === 0) {
      return null;
    }

    return timestamps.sort().at(-1) ?? null;
  }, [status]);
  const schedulerPassiveByStartupLock = status?.schedulerStatus === 'passive_startup_lock';
  const statusDot: 'success' | 'warning' = statusError || schedulerPassiveByStartupLock ? 'warning' : 'success';
  const statusLabel = statusError
    ? 'Status delayed'
    : schedulerPassiveByStartupLock
      ? 'Scheduler paused'
      : 'Healthy';
  const statusDetail = statusError
    ? `Last: ${formatShortDate(lastSeen)}`
    : schedulerPassiveByStartupLock
      ? 'Startup lock already held'
      : `Last: ${formatShortDate(lastSeen)}`;

  if (pathname.startsWith('/login')) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-0 text-text-1">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border bg-[var(--sidebar-bg)] backdrop-blur-[20px] lg:flex">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--accent),var(--accent-hover))] text-primary-foreground shadow-[0_0_16px_var(--accent-glow)]">
              <ArrowLeftRight className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">Grocy-Mealie Sync</p>
              <AppVersion className="mt-1" />
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
          {NAV_ITEMS.map(item => {
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold transition-all',
                  active
                    ? 'bg-accent-subtle text-primary shadow-[inset_3px_0_0_var(--accent)]'
                    : 'text-text-2 hover:bg-white/8 hover:text-text-1',
                )}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 pb-2">
          <Link
            href="/api-endpoints"
            className={cn(
              'flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors',
              navActive(pathname, '/api-endpoints')
                ? 'bg-accent-subtle text-primary shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-text-2 hover:bg-white/8 hover:text-text-1',
            )}
          >
            <Server className="size-4" />
            API Endpoints
          </Link>
        </div>

        <div className="border-t border-border px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <AppStatusDot status={statusDot} />
            <span className={cn('font-semibold', schedulerPassiveByStartupLock ? 'text-warning' : 'text-text-2')}>
              {statusLabel}
            </span>
          </div>
          <p className={cn('mt-1 font-mono text-[11px]', schedulerPassiveByStartupLock ? 'text-warning/90' : 'text-text-3')}>
            {statusDetail}
          </p>
          {schedulerPassiveByStartupLock ? (
            <Link
              href="/settings"
              className="mt-1 inline-block text-[11px] font-semibold text-warning underline underline-offset-2 hover:text-warning/80"
            >
              Open settings for lock recovery
            </Link>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-[var(--topbar-bg)] px-3 backdrop-blur-[20px] lg:px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold lg:text-base">{pageTitle(pathname)}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-white/6 px-2 py-1 lg:flex">
              <div className="relative flex items-center rounded-lg border border-border/70 bg-white/5 p-0.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-primary shadow-[0_0_18px_var(--accent-glow),0_3px_12px_color-mix(in_oklab,var(--accent)_28%,transparent)] transition-transform duration-200',
                    theme === 'light' ? 'translate-x-full' : 'translate-x-0',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-label="Dark theme"
                  aria-pressed={theme === 'dark'}
                  title="Dark theme"
                  className={cn(
                    'relative z-10 flex h-6 w-12 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors',
                    theme === 'dark' ? 'text-primary-foreground' : 'text-text-2 hover:text-text-1',
                  )}
                >
                  <Moon className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-label="Light theme"
                  aria-pressed={theme === 'light'}
                  title="Light theme"
                  className={cn(
                    'relative z-10 flex h-6 w-12 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors',
                    theme === 'light' ? 'text-primary-foreground' : 'text-text-2 hover:text-text-1',
                  )}
                >
                  <Sun className="size-3" />
                </button>
              </div>
              <SearchableSelect<AccentMode>
                value={accent}
                onChange={value => {
                  if (value) {
                    setAccent(value);
                  }
                }}
                options={ACCENT_OPTIONS}
                clearable={false}
                placeholder="Accent"
                ariaLabel="Accent color"
                className="w-[120px]"
                controlClassName="h-8 border-input bg-input/70 focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </div>
            {authEnabled ? <LogoutButton /> : null}
          </div>
        </header>

        <main className="main-content page-enter flex-1 overflow-auto bg-transparent px-3 py-4 lg:px-6 lg:py-6">{children}</main>
      </div>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-[var(--sidebar-bg)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-[20px] lg:hidden">
        {NAV_ITEMS.map(item => {
          const active = navActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 px-1 py-1 text-[10px] font-semibold',
                active ? 'text-primary' : 'text-text-3',
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
