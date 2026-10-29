'use client';

import { Button } from '@/components/ui/button';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName, pausedLines, PAUSE_LABELS, post } from '../shop-common';
import { EmptyState, Panel, PluginChip, RowItem, RowList } from '../shop-ui';

/** Lines gm-sync stopped managing because the retailer list no longer matches what it wrote. */
export function PausedLines({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  const paused = pausedLines(overview);
  return (
    <Panel title="Paused list lines" subtitle="gm-sync never guesses whose units disappeared. Tell it what happened.">
      {paused.length === 0 ? <EmptyState title="No paused lines." tone="good">Every managed line matches what gm-sync last wrote.</EmptyState> : (
        <RowList>
          {paused.map(line => {
            const releaseOnly = line.kind === 'note' || line.pausedReason === 'duplicate_lines' || line.pausedReason === 'line_reused';
            return (
              <RowItem
                key={`${line.installationId}:${line.kind}:${line.retailerProductId}`}
                actions={(['user_units_removed', 'readd', 'release'] as const).filter(resolution => line.kind !== 'note' || resolution === 'release').map(resolution => (
                  <Button
                    key={resolution}
                    size="sm"
                    variant={resolution === 'release' ? 'ghost' : 'outline'}
                    disabled={releaseOnly && resolution !== 'release'}
                    onClick={async () => {
                      if (await post('/api/shop/lines/resolve', { installationId: line.installationId, retailerProductId: line.retailerProductId, kind: line.kind, resolution }, 'Line updated')) await reload();
                    }}
                  >
                    {resolution === 'user_units_removed' ? 'Someone removed their own units' : resolution === 'readd' ? 'Add mine again' : 'Release this line'}
                  </Button>
                ))}
              >
                <p><span className="font-semibold">{line.kind === 'note' ? line.noteText ?? line.productName : line.productName}</span> · {PAUSE_LABELS[line.pausedReason ?? ''] ?? line.pausedReason}</p>
                <p className="text-xs text-text-2"><PluginChip className="mr-2" name={installationName(overview, line.installationId)} /><span className="font-mono">now {line.pausedObservedQty ?? 0}, last written {line.lastWrittenQty}</span></p>
              </RowItem>
            );
          })}
        </RowList>
      )}
    </Panel>
  );
}
