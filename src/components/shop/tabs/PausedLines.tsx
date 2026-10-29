'use client';

import type { ShopOverview } from '@/lib/shop/overview';
import { Clock } from 'lucide-react';
import { installationName, pausedLines, PAUSE_LABELS, post } from '../shop-common';
import { Badge, DButton, EmptyState, Panel, PluginChip, RowItem, RowList } from '../shop-ui';

/** Lines gm-sync stopped managing because the retailer list no longer matches what it wrote. */
export function PausedLines({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  const paused = pausedLines(overview);
  return (
    <Panel testId="panel-paused" icon={<Clock className="size-4" />} title="Paused list lines" subtitle="A managed line is paused as soon as the list no longer matches what gm-sync wrote. gm-sync never guesses whose units disappeared; tell it what happened.">
      {paused.length === 0 ? <EmptyState tone="good" title="No paused lines">Every managed line on your shared lists matches what gm-sync last wrote.</EmptyState> : (
        <RowList>
          {paused.map(line => {
            const releaseOnly = line.kind === 'note' || line.pausedReason === 'duplicate_lines' || line.pausedReason === 'line_reused';
            const resolve = async (resolution: 'user_units_removed' | 'readd' | 'release') => {
              if (await post('/api/shop/lines/resolve', { installationId: line.installationId, retailerProductId: line.retailerProductId, kind: line.kind, resolution }, 'Line updated')) await reload();
            };
            return (
              <RowItem
                key={`${line.installationId}:${line.kind}:${line.retailerProductId}`}
                testId="paused-line"
                actions={<>
                  {line.kind !== 'note' ? <>
                    <DButton disabled={releaseOnly} onClick={() => void resolve('user_units_removed')}>Someone removed their own units</DButton>
                    <DButton disabled={releaseOnly} onClick={() => void resolve('readd')}>Add mine again</DButton>
                  </> : null}
                  <DButton variant="ghost" onClick={() => void resolve('release')}>Release this line</DButton>
                </>}
              >
                <strong>{line.kind === 'note' ? line.noteText ?? line.productName : line.productName}</strong>
                <div className="row-sub"><PluginChip name={installationName(overview, line.installationId)} /></div>
                <div className="row-badges"><Badge tone="warning">{PAUSE_LABELS[line.pausedReason ?? ''] ?? line.pausedReason}</Badge></div>
                <p className="row-reason mono">now {line.pausedObservedQty ?? 0}, last written {line.lastWrittenQty}</p>
                <p className="row-hint">gm-sync never guesses whose units disappeared, so this line stays untouched until you decide.</p>
              </RowItem>
            );
          })}
        </RowList>
      )}
    </Panel>
  );
}
