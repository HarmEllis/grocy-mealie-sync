'use client';

import Link from 'next/link';
import { formatRunCountdown, useAppClock, useAppStatus } from '@/components/sync/AppStatusProvider';
import { AppCard } from '@/components/redesign/primitives';
import { formatDateTime } from '@/lib/date-time';
import type { ShopDashboardStatus } from '@/lib/shop/status';

const STATE_LABELS = {
  disabled: 'Receipt processing disabled',
  disconnected: 'Waiting for plugin connection and active scheduler',
  unsupported: 'Plugin does not support receipts',
  signed_out: 'Waiting for retailer sign-in',
  ready: 'Connected',
};

export function DashboardShopStatus({ initialStatus = null, timeZone, locale, details = false }: {
  initialStatus?: ShopDashboardStatus | null;
  timeZone: string | null;
  locale: string | null;
  details?: boolean;
}) {
  const shared = useAppStatus();
  const now = useAppClock();
  const status = shared.status ? shared.status.shop ?? null : initialStatus;
  const unavailable = shared.unavailable || Boolean(shared.status && !shared.status.shop);

  if (!status) return details ? <p className="text-sm text-text-3">{unavailable ? 'Status unavailable' : 'Loading sync status…'}</p> : null;
  if (!details && !status.receipts.length && !status.lastJob) return null;
  const date = (value: string | null) => formatDateTime(value, { fallback: 'Never', timeZone, locale });
  const countdown = (value: string | null) => formatRunCountdown(value, now, unavailable, 'Due / waiting for worker');

  const summary = <>
    <div>
      <p className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Last shopping job</p>
      <p className="font-mono text-sm font-semibold text-text-1">{date(status.lastJob?.finishedAt ?? null)}{details && status.lastJob ? ` · ${status.lastJob.status}` : ''}</p>
    </div>
    <div>
      <p className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Next shopping sync</p>
      <p className="font-mono text-sm font-semibold text-text-1">{countdown(status.nextProcessingAt)}</p>
    </div>
  </>;

  if (!details) return summary;

  return <AppCard>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight">Sync diagnostics</h2>
      <Link href="/history" className="text-sm text-primary underline">View full history</Link>
    </div>
    <div className="mt-3 flex flex-wrap gap-6 text-sm">
      {summary}
    </div>
    <div className="mt-3 space-y-3">
      {!status.receipts.length ? <p className="text-sm text-text-3">No shop plugins installed.</p> : null}
      {status.receipts.map(receipt => <div key={receipt.installationId} className="rounded-lg border border-border p-3 text-sm">
        <p className="font-semibold">{receipt.name} · {STATE_LABELS[receipt.state]}</p>
        <p className="mt-1 text-text-2">Last receipt check: {date(receipt.lastCheckedAt)} · Next check: {countdown(receipt.nextCheckAt)}</p>
        <p className="mt-1 text-text-2">Last list sync: {date(receipt.listSync?.finishedAt ?? null)}{receipt.listSync ? ` · ${receipt.listSync.result.status} · ${receipt.listSync.result.applied} applied · ${receipt.listSync.result.failed} failed · ${receipt.listSync.result.conflicts} conflicts` : ''}</p>
        {receipt.listSync?.result.message ? <p className="mt-1 text-text-2">{receipt.listSync.result.message}</p> : null}
        {receipt.lastError ? <p className="mt-1 text-destructive">Last check failed: {receipt.lastError}</p> : null}
      </div>)}
    </div>
    <p className="mt-3 text-xs text-text-3">Receipt checks run every 30 minutes, and on reconnect or a new-receipt notification. The worker checks the schedule every minute. Processing follows the regular sync cycle; busy jobs can delay it.</p>
  </AppCard>;
}
