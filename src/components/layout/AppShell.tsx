'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, History, LayoutDashboard, Link2, Moon, Server, Settings2, Sun } from 'lucide-react';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { AppVersion } from '@/components/app/AppVersion';
import { AppButton, AppSelect, AppStatusDot } from '@/components/redesign/primitives';
import { useThemePreferences } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

interface ShellStatus {
  lastGrocyPoll: string | null;
  lastMealiePoll: string | null;
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
  { value: 'teal', label: 'Teal' },
  { value: 'violet', label: 'Violet' },
  { value: 'amber', label: 'Amber' },
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
            <AppStatusDot status={statusError ? 'warning' : 'success'} />
            <span className="font-semibold text-text-2">{statusError ? 'Status delayed' : 'Healthy'}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-3">Last: {formatShortDate(lastSeen)}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-[var(--topbar-bg)] px-3 backdrop-blur-[20px] lg:px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold lg:text-base">{pageTitle(pathname)}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-white/6 px-2 py-1 lg:flex">
              <AppButton
                size="icon-xs"
                variant={theme === 'dark' ? 'default' : 'ghost'}
                className="size-6"
                onClick={() => setTheme('dark')}
                title="Dark theme"
                aria-label="Dark theme"
              >
                <Moon className="size-3" />
              </AppButton>
              <AppButton
                size="icon-xs"
                variant={theme === 'light' ? 'default' : 'ghost'}
                className="size-6"
                onClick={() => setTheme('light')}
                title="Light theme"
                aria-label="Light theme"
              >
                <Sun className="size-3" />
              </AppButton>
              <AppSelect
                value={accent}
                onChange={event => {
                  const value = event.target.value;
                  if (value === 'teal' || value === 'violet' || value === 'amber') {
                    setAccent(value);
                  }
                }}
                className="w-[110px]"
              >
                {ACCENT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </AppSelect>
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
