'use client';

import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { AppBadge } from '@/components/redesign/primitives';
import { formatRunCountdown, useAppClock, useAppStatus } from '@/components/sync/AppStatusProvider';
import { formatDateTime } from '@/lib/date-time';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName, PAUSE_LABELS, receiptCheckWindow } from '../shop-common';
import { DataRow, DataTable, EmptyState, KeyValues, Panel, PluginChip } from '../shop-ui';

const STATE_LABELS = {
  disabled: 'Receipt processing disabled',
  disconnected: 'Waiting for plugin connection and active scheduler',
  unsupported: 'Plugin does not support receipts',
  signed_out: 'Waiting for retailer sign-in',
  ready: 'Connected',
};

const STATE_TONE = { disabled: 'default', disconnected: 'warning', unsupported: 'default', signed_out: 'warning', ready: 'success' } as const;

export function DiagnosticsTab({ overview, timeZone, locale }: { overview: ShopOverview | null; timeZone: string | null; locale: string | null }) {
  const shared = useAppStatus();
  const now = useAppClock();
  const status = shared.status?.shop ?? null;
  const unavailable = shared.unavailable || Boolean(shared.status && !shared.status.shop);
  const date = (value: string | null) => formatDateTime(value, { fallback: 'Never', timeZone, locale });
  const countdown = (value: string | null) => formatRunCountdown(value, now, unavailable, 'Due / waiting for worker');

  const { last: lastReceiptCheck, next: nextReceiptCheck } = status ? receiptCheckWindow(status) : { last: null, next: null };

  return (
    <div className="space-y-4">
      <Panel title="Sync diagnostics" tools={<Link href="/history" className="text-sm text-primary underline">View full history</Link>}>
        {!status ? <EmptyState>{unavailable ? 'Status unavailable' : 'Loading sync status…'}</EmptyState> : (
          <div className="grid gap-4 border-t border-border px-4 py-3 sm:grid-cols-3 md:px-5">
            <div>
              <p title="Latest receipt fetch attempt, including failed checks" className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Last receipt fetch</p>
              <p className="font-mono text-sm font-semibold text-text-1">{date(lastReceiptCheck)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Next receipt fetch</p>
              <p className="font-mono text-sm font-semibold text-text-1">{countdown(nextReceiptCheck)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-text-3 uppercase">Last shopping job</p>
              <p className="font-mono text-sm font-semibold text-text-1">{date(status.lastJob?.finishedAt ?? null)}{status.lastJob ? ` · ${status.lastJob.status}` : ''}</p>
            </div>
          </div>
        )}
      </Panel>

      {status ? (
        <Panel
          title="Per plugin"
          subtitle="State, schedule and the result of the last list sync."
          footer={<><Leaf className="mt-0.5 size-3.5 shrink-0" /><span>Receipt checks run every 30 minutes, and on reconnect or a new-receipt notification. The worker checks the schedule every minute. Processing follows the regular sync cycle; busy jobs can delay it.</span></>}
        >
          {!status.receipts.length ? <EmptyState>No shop plugins installed.</EmptyState> : (
            <div className="grid gap-3 border-t border-border p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
              {status.receipts.map(receipt => (
                <div key={receipt.installationId} className="min-w-0 space-y-2 rounded-lg border border-border bg-bg-0/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PluginChip name={receipt.name} className="font-semibold text-text-1" />
                    <AppBadge small tone={STATE_TONE[receipt.state]}>{STATE_LABELS[receipt.state]}</AppBadge>
                  </div>
                  <KeyValues rows={[
                    ['Last receipt check', date(receipt.lastCheckedAt)],
                    ['Next check', countdown(receipt.nextCheckAt)],
                    ['Last list sync', `${date(receipt.listSync?.finishedAt ?? null)}${receipt.listSync ? ` · ${receipt.listSync.result.status}` : ''}`],
                    ...(receipt.listSync ? [['Applied / failed / conflicts', `${receipt.listSync.result.applied} / ${receipt.listSync.result.failed} / ${receipt.listSync.result.conflicts}`] as [string, string]] : []),
                  ]} />
                  {receipt.listSync?.result.message ? <p className="text-xs text-text-2">{receipt.listSync.result.message}</p> : null}
                  {receipt.lastError ? <p className="rounded-md border border-[var(--badge-error-text)]/40 bg-[var(--badge-error-bg)] p-2 text-xs text-destructive">Last check failed: {receipt.lastError}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {overview ? (
        <Panel title="List cleanup" subtitle="When open demand disappears, gm-sync removes its managed quantity. Quantities added by the household remain.">
          {overview.lines.length === 0 ? <EmptyState>gm-sync manages no list lines right now.</EmptyState> : (
            <DataTable headers={['Product', 'Plugin', 'Managed', 'Household', 'Desired', 'Pause reason']}>
              {overview.lines.map(line => {
                const desired = line.kind === 'note' ? 'Not applicable (replacement note)' : String(overview.exports.find(row => row.installationId === line.installationId && row.retailerProductId === line.retailerProductId)?.packages ?? 0);
                return (
                  <DataRow key={`${line.installationId}:${line.kind}:${line.retailerProductId}`} columns={6} cells={[
                    ['Product', <span key="p" className="font-semibold">{line.productName}</span>],
                    ['Plugin', <PluginChip key="i" name={installationName(overview, line.installationId)} />],
                    ['Managed', <span key="m" className="font-mono">{line.managedQty}</span>],
                    ['Household', <span key="h" className="font-mono">{line.baselineUserQty}</span>],
                    ['Desired', <span key="d" className="font-mono">{desired}</span>],
                    ['Pause reason', line.pausedReason ? <AppBadge key="r" small tone="warning">{PAUSE_LABELS[line.pausedReason] ?? line.pausedReason}</AppBadge> : <span key="r" className="text-text-3">None</span>],
                  ]} />
                );
              })}
            </DataTable>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
