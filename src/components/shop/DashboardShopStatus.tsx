'use client';

import { formatRunCountdown, useAppClock, useAppStatus } from '@/components/sync/AppStatusProvider';
import { formatDateTime } from '@/lib/date-time';
import { receiptCheckWindow } from './shop-common';
import type { ShopDashboardStatus } from '@/lib/shop/status';

export function DashboardShopStatus({ initialStatus = null, timeZone, locale }: {
  initialStatus?: ShopDashboardStatus | null;
  timeZone: string | null;
  locale: string | null;
}) {
  const shared = useAppStatus();
  const now = useAppClock();
  const status = shared.status ? shared.status.shop ?? null : initialStatus;
  const unavailable = shared.unavailable || Boolean(shared.status && !shared.status.shop);

  if (!status?.receipts.length) return null;
  const date = (value: string | null) => formatDateTime(value, { fallback: 'Never', timeZone, locale });
  const countdown = (value: string | null) => formatRunCountdown(value, now, unavailable, 'Due / waiting for worker');
  const { last: lastReceiptCheck, next: nextReceiptCheck } = receiptCheckWindow(status);

  return <>
    <div>
      <p title="Latest receipt fetch attempt, including failed checks" className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Last receipt fetch</p>
      <p className="font-mono text-sm font-semibold text-text-1">{date(lastReceiptCheck)}</p>
    </div>
    <div>
      <p className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Next receipt fetch</p>
      <p className="font-mono text-sm font-semibold text-text-1">{countdown(nextReceiptCheck)}</p>
    </div>
  </>;
}
