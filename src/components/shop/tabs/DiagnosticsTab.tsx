'use client';

import Link from 'next/link';
import { ArrowRight, Clock, Leaf, Plug } from 'lucide-react';
import { formatRunCountdown, useAppClock, useAppStatus } from '@/components/sync/AppStatusProvider';
import { formatDateTime } from '@/lib/date-time';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName, PAUSE_LABELS, receiptCheckWindow } from '../shop-common';
import { Badge, DataRow, DataTable, EmptyState, KeyValues, Panel, PluginChip, ShopLogo } from '../shop-ui';

const STATE_LABELS = {
  disabled: 'Receipt processing disabled',
  disconnected: 'Waiting for plugin connection and active scheduler',
  unsupported: 'Plugin does not support receipts',
  signed_out: 'Waiting for retailer sign-in',
  ready: 'Connected',
};

const STATE_TONE = { disabled: '', disconnected: 'warning', unsupported: '', signed_out: 'warning', ready: 'success' } as const;

export function DiagnosticsTab({ overview, timeZone, locale }: { overview: ShopOverview | null; timeZone: string | null; locale: string | null }) {
  const shared = useAppStatus();
  const now = useAppClock();
  const status = shared.status?.shop ?? null;
  const unavailable = shared.unavailable || Boolean(shared.status && !shared.status.shop);
  const date = (value: string | null) => formatDateTime(value, { fallback: 'Never', timeZone, locale });
  const countdown = (value: string | null) => formatRunCountdown(value, now, unavailable, 'Due / waiting for worker');
  const { last: lastReceiptCheck, next: nextReceiptCheck } = status ? receiptCheckWindow(status) : { last: null, next: null };
  const countdownText = countdown(nextReceiptCheck);
  const due = countdownText.startsWith('Due');
  const jobTone = status?.lastJob ? (status.lastJob.status === 'success' ? 'success' : status.lastJob.status === 'error' ? 'danger' : 'warning') : '';

  return (
    <>
      <Panel
        testId="panel-sync-diagnostics"
        icon={<Clock className="size-4" />}
        title="Sync diagnostics"
        tools={<Link href="/history" className="button ghost" data-testid="view-full-history"><ArrowRight className="size-3.5" /> View full history</Link>}
      >
        {!status ? <EmptyState icon={<Clock className="size-5" />} title={unavailable ? 'Status unavailable' : 'Loading sync status…'} /> : (
          <div className="diag-top">
            <div className="diag-cell">
              <span title="Latest receipt fetch attempt, including failed checks">Last receipt fetch</span>
              <strong>{date(lastReceiptCheck)}</strong>
              <small>Reference data only</small>
            </div>
            <div className="diag-cell">
              <span>Next receipt fetch</span>
              <strong>{due ? 'Due / waiting for worker' : date(nextReceiptCheck)}</strong>
              <small>{due ? 'The worker picks this up within a minute' : `in ${countdownText}`}</small>
            </div>
            <div className="diag-cell">
              <span>Last shopping job</span>
              <strong>{date(status.lastJob?.finishedAt ?? null)}</strong>
              <small>{status.lastJob ? <Badge tone={jobTone}>{status.lastJob.status}</Badge> : null}</small>
            </div>
          </div>
        )}
      </Panel>

      {status ? (
        <Panel
          testId="panel-plugin-diagnostics"
          icon={<Plug className="size-4" />}
          title="Per plugin"
          subtitle="State, schedule and the result of the last list sync."
          footer={<><Clock className="size-3.5" /><span>Receipt checks run every 30 minutes and on reconnect or a new-receipt notification. The worker checks the schedule every minute. Processing follows the regular sync cycle, so a busy job can delay it.</span></>}
        >
          {!status.receipts.length ? <EmptyState icon={<Plug className="size-5" />} title="No plugins to report on">Diagnostics appear once a shop plugin is installed.</EmptyState> : (
            <div className="diag-grid">
              {status.receipts.map(receipt => (
                <article key={receipt.installationId} className="diag-card" data-testid={`diag-${receipt.installationId}`}>
                  <div className="diag-card-head">
                    <ShopLogo name={receipt.name} />
                    <h3>{receipt.name}</h3>
                    <Badge tone={STATE_TONE[receipt.state]}>{STATE_LABELS[receipt.state]}</Badge>
                  </div>
                  <KeyValues rows={[
                    ['Last receipt check', date(receipt.lastCheckedAt)],
                    ['Next check', countdown(receipt.nextCheckAt)],
                    ['Last list sync', receipt.listSync ? `${date(receipt.listSync.finishedAt)} · ${receipt.listSync.result.status}` : 'Never'],
                    ['Applied / failed / conflicts', receipt.listSync ? `${receipt.listSync.result.applied} / ${receipt.listSync.result.failed} / ${receipt.listSync.result.conflicts}` : '0 / 0 / 0'],
                  ]} />
                  {receipt.listSync?.result.message ? <p className="row-hint">{receipt.listSync.result.message}</p> : null}
                  {receipt.lastError ? <div className="diag-error"><strong>Last check error</strong><span>Last check failed: {receipt.lastError}</span></div> : null}
                </article>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {overview ? (
        <Panel testId="panel-cleanup" icon={<Leaf className="size-4" />} title="List cleanup" subtitle="When open demand disappears gm-sync removes its own managed quantity. Household quantities stay exactly as they are.">
          {overview.lines.length === 0 ? <EmptyState tone="good" title="Nothing to clean up">Every managed quantity matches the current demand.</EmptyState> : (
            <DataTable headers={['Product', 'Plugin', 'Managed qty', 'Household qty', 'Desired packages', 'Pause reason']} cols="minmax(0,1.3fr) minmax(100px,.7fr) minmax(90px,.6fr) minmax(90px,.6fr) minmax(120px,.9fr) minmax(130px,1fr)">
              {overview.lines.map(line => {
                const desired = line.kind === 'note' ? 'Not applicable (replacement note)' : String(overview.exports.find(row => row.installationId === line.installationId && row.retailerProductId === line.retailerProductId)?.packages ?? 0);
                return (
                  <DataRow key={`${line.installationId}:${line.kind}:${line.retailerProductId}`} cells={[
                    ['Product', <strong key="p">{line.productName}</strong>],
                    ['Plugin', <PluginChip key="i" name={installationName(overview, line.installationId)} />],
                    ['Managed qty', <span key="m" className="mono">{line.managedQty}</span>],
                    ['Household qty', <span key="h" className="mono">{line.baselineUserQty}</span>],
                    ['Desired packages', <span key="d" className="mono">{desired}</span>],
                    ['Pause reason', line.pausedReason ? <Badge key="r" tone="warning">{PAUSE_LABELS[line.pausedReason] ?? line.pausedReason}</Badge> : <span key="r" className="muted">—</span>],
                  ]} />
                );
              })}
            </DataTable>
          )}
        </Panel>
      ) : null}
    </>
  );
}
