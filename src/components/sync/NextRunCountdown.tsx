'use client';

import { formatRunCountdown, useAppClock, useAppStatus } from './AppStatusProvider';

export function NextRunCountdown({ initialNextRunAt }: { initialNextRunAt: string | null }) {
  const { status, unavailable } = useAppStatus();
  const now = useAppClock();
  const nextRunAt = status && 'nextRunAt' in status ? status.nextRunAt ?? null : initialNextRunAt;
  const value = formatRunCountdown(nextRunAt, now, unavailable || Boolean(status && !('nextRunAt' in status)), 'Due / waiting for scheduler');

  return <div>
    <p className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Next run in</p>
    <p className="font-mono text-sm font-semibold text-text-1">{value}</p>
  </div>;
}
