'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ShopDashboardStatus } from '@/lib/shop/status';

interface AppStatus {
  lastGrocyPoll: string | null;
  lastMealiePoll: string | null;
  schedulerStatus?: 'active' | 'passive_startup_lock' | 'inactive';
  nextRunAt?: string | null;
  shop?: ShopDashboardStatus | null;
}

const StatusContext = createContext<{ status: AppStatus | null; unavailable: boolean }>({
  status: null, unavailable: false,
});

const ClockContext = createContext<number | null>(null);

/** One status request and clock shared by the shell and shopping countdowns. */
export function AppStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch('/api/status', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Status unavailable');
        const body = await response.json();
        if (!body || typeof body !== 'object') throw new Error('Invalid status');
        if (!controller.signal.aborted) { setStatus(body); setUnavailable(false); }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally { refreshing = false; }
    };
    setNow(Date.now());
    void refresh();
    const poll = window.setInterval(() => void refresh(), 15_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { controller.abort(); window.clearInterval(poll); window.clearInterval(clock); };
  }, []);
  const value = useMemo(() => ({ status, unavailable }), [status, unavailable]);
  return <StatusContext.Provider value={value}><ClockContext.Provider value={now}>{children}</ClockContext.Provider></StatusContext.Provider>;
}

export function useAppClock() { return useContext(ClockContext); }

export function useAppStatus() { return useContext(StatusContext); }

export function formatRunCountdown(value: string | null, now: number | null, unavailable: boolean, dueLabel: string): string {
  if (unavailable) return 'Status unavailable';
  if (!value) return 'Paused';
  if (now === null) return 'Loading…';
  const seconds = Math.ceil((new Date(value).getTime() - now) / 1000);
  if (!Number.isFinite(seconds)) return 'Status unavailable';
  return seconds <= 0 ? dueLabel
    : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
