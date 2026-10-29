'use client';

import { Leaf, ReceiptText, ShoppingCart, Plug, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppBadge } from '@/components/redesign/primitives';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName, pausedLines, PAUSE_LABELS, post, when } from '../shop-common';
import { DataRow, DataTable, EmptyState, Panel, PluginChip, RowItem, RowList } from '../shop-ui';
import { ProjectionReview } from './ProjectionReview';

export function OverviewTab({ overview, reload, goTo }: { overview: ShopOverview; reload: () => Promise<void>; goTo: (tab: 'review' | 'diagnostics') => void }) {
  const paused = pausedLines(overview);
  const notes = overview.lines.filter(line => line.kind === 'note' && line.noteText && !line.pausedReason);
  return (
    <div className="space-y-4">
      <Panel title="Plugins" icon={<Plug className="size-4" />} subtitle="One entry per installation. Capabilities come from the plugin itself.">
        <RowList>
          {overview.installations.map(installation => (
            <RowItem key={installation.id} actions={<Button size="sm" variant="ghost" onClick={() => goTo('diagnostics')}><History className="size-3.5" /> Diagnostics</Button>}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{installation.name}</span>
                <AppBadge small tone={installation.connected ? 'success' : 'default'}>{installation.connected ? 'connected' : 'offline'}</AppBadge>
                {installation.features?.includes('list.notes') ? <AppBadge small>text items</AppBadge> : null}
                {installation.settings.listSyncEnabled ? <AppBadge small>list sync</AppBadge> : null}
                {installation.settings.receiptsEnabled ? <AppBadge small>receipts</AppBadge> : null}
                {installation.pendingListApply ? <AppBadge small tone="warning">list write pending confirmation</AppBadge> : null}
              </div>
              <p className="text-xs text-text-2">
                {installation.features?.includes('list.notes')
                  ? 'A discontinued product can be replaced by an ingredient and quantity text item.'
                  : 'No text-item support: a discontinued product pauses the line instead of becoming a text item.'}
              </p>
            </RowItem>
          ))}
        </RowList>
      </Panel>

      <ProjectionReview overview={overview} limit={3} onOpenReview={() => goTo('review')} />

      <Panel
        title="On the shared list"
        icon={<ShoppingCart className="size-4" />}
        subtitle="Packages gm-sync currently wants on each retailer list."
        footer={<><Leaf className="mt-0.5 size-3.5 shrink-0" /><span>Your own additions are kept. gm-sync only manages the quantity it wrote itself.</span></>}
      >
        {overview.exports.length === 0 ? <EmptyState title="Nothing exported.">gm-sync has no packages to put on a shared retailer list right now.</EmptyState> : (
          <DataTable headers={['Plugin', 'Product', 'Packages', 'Since']}>
            {overview.exports.map(row => (
              <DataRow key={row.id} columns={4} cells={[
                ['Plugin', <PluginChip key="p" name={installationName(overview, row.installationId)} />],
                ['Product', <span key="n" className="font-semibold">{row.productName}</span>],
                ['Packages', <span key="k" className="font-mono">{row.packages}</span>],
                ['Since', <span key="s" className="font-mono text-xs">{when(row.createdAt)}</span>],
              ]} />
            ))}
          </DataTable>
        )}
      </Panel>

      {notes.length > 0 ? (
        <Panel
          title="Replacement text items"
          icon={<ReceiptText className="size-4" />}
          subtitle="A discontinued product is represented by one ingredient and quantity note."
          footer={<span>Checking or removing a note never fulfils Mealie demand; receipts determine purchases.</span>}
        >
          <RowList>
            {notes.map(line => (
              <RowItem key={`${line.installationId}:${line.retailerProductId}`}>
                <p className="font-mono font-semibold">{line.noteText}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-text-2">
                  <PluginChip name={installationName(overview, line.installationId)} />
                  <span>replaces {line.productName}</span>
                </p>
              </RowItem>
            ))}
          </RowList>
        </Panel>
      ) : null}

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
    </div>
  );
}
