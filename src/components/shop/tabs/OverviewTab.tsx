'use client';

import { Leaf, ReceiptText, ShoppingCart, Plug, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppBadge } from '@/components/redesign/primitives';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName, when } from '../shop-common';
import { DataRow, DataTable, EmptyState, Panel, PluginChip, RowItem, RowList } from '../shop-ui';
import { PausedLines } from './PausedLines';
import { ProjectionReview } from './ProjectionReview';

export function OverviewTab({ overview, reload, goTo }: { overview: ShopOverview; reload: () => Promise<void>; goTo: (tab: 'review' | 'diagnostics') => void }) {
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
              <DataRow key={row.id} cells={[
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

      <PausedLines overview={overview} reload={reload} />
    </div>
  );
}
