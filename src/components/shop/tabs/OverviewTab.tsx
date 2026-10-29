'use client';

import { Leaf, Plug, ReceiptText, ShoppingCart, History } from 'lucide-react';
import { toast } from 'sonner';
import type { ShopOverview } from '@/lib/shop/overview';
import { installationName } from '../shop-common';
import { useWhen } from '../shop-format';
import { Badge, DataRow, DataTable, DButton, EmptyState, Panel, PluginChip, RowItem, RowList, ShopLogo } from '../shop-ui';
import { PausedLines } from './PausedLines';
import { ProjectionReview } from './ProjectionReview';

export function OverviewTab({ overview, reload, goTo, openProducts }: {
  overview: ShopOverview;
  reload: () => Promise<void>;
  goTo: (tab: 'review' | 'diagnostics') => void;
  openProducts: (query: string) => void;
}) {
  const when = useWhen();
  const notes = overview.lines.filter(line => line.kind === 'note' && line.noteText && !line.pausedReason);
  return (
    <>
      <Panel testId="panel-plugins" icon={<Plug className="size-4" />} title="Shop plugins" subtitle="One card per installation. Capabilities come from the plugin itself.">
        <RowList>
          {overview.installations.map(installation => (
            <RowItem
              key={installation.id}
              testId="plugin-row"
              actions={<DButton variant="ghost" onClick={() => goTo('diagnostics')}><History className="size-3.5" /> Diagnostics</DButton>}
            >
              <strong>{installation.name}</strong>
              <div className="row-sub">
                <ShopLogo name={installation.name} />
                <Badge tone={installation.connected ? 'success' : 'warning'}>{installation.connected ? 'connected' : 'offline'}</Badge>
                {installation.features?.includes('list.notes') ? <Badge tone="info">text items</Badge> : null}
                {installation.settings.listSyncEnabled ? <Badge tone="info">list sync</Badge> : null}
                {installation.settings.receiptsEnabled ? <Badge tone="info">receipts</Badge> : null}
              </div>
              <p className="row-hint">
                {installation.features?.includes('list.notes')
                  ? <>Supports <span className="mono">list.notes</span>, so a discontinued product can be replaced by an ingredient and quantity note.</>
                  : 'No text-item support: a discontinued product pauses the line instead of becoming a note.'}
              </p>
              {installation.pendingListApply ? (
                <div className="row-reason"><Badge tone="warning">list write pending confirmation</Badge> The retailer did not confirm the last write to this list. gm-sync checks it again at the start of the next list sync and leaves the list alone until then.</div>
              ) : null}
            </RowItem>
          ))}
        </RowList>
      </Panel>

      <ProjectionReview overview={overview} limit={3} onOpenReview={() => goTo('review')} openProducts={openProducts} />

      <Panel
        testId="panel-shared"
        icon={<ShoppingCart className="size-4" />}
        title="On the shared list"
        subtitle="The packages gm-sync currently wants on each retailer list."
        footer={<><Leaf className="size-3.5" /><span>Your own additions are kept. gm-sync only ever manages the quantity it wrote itself.</span></>}
      >
        {overview.exports.length === 0 ? <EmptyState icon={<ShoppingCart className="size-5" />} title="Nothing exported">gm-sync has no packages to put on a shared retailer list right now.</EmptyState> : (
          <DataTable headers={['Plugin', 'Product', 'Packages', 'Since']} cols="minmax(130px,.8fr) minmax(0,1.6fr) minmax(90px,.7fr) minmax(110px,.8fr)">
            {overview.exports.map(row => (
              <DataRow key={row.id} testId="shared-row" cells={[
                ['Plugin', <PluginChip key="p" name={installationName(overview, row.installationId)} />],
                ['Product', <strong key="n">{row.productName}</strong>],
                ['Packages', <span key="k" className="mono">{row.packages}</span>],
                ['Since', <span key="s" className="mono">{when(row.createdAt)}</span>],
              ]} />
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel
        testId="panel-notes"
        icon={<ReceiptText className="size-4" />}
        title="Replacement text items"
        subtitle="A discontinued product is represented by one ingredient and quantity note."
        footer={<><span>Checking or removing a note never fulfils Mealie demand. Receipts determine what was actually purchased.</span></>}
      >
        {notes.length === 0 ? <EmptyState icon={<ReceiptText className="size-5" />} title="No replacement notes">Every product on your lists still has a catalogue match.</EmptyState> : (
          <RowList>
            {notes.map(line => (
              <RowItem
                key={`${line.installationId}:${line.retailerProductId}`}
                testId="note-row"
                actions={<DButton variant="ghost" onClick={() => toast.message('Receipts decide what was bought. Checking a note off changes nothing in Mealie.')}><ReceiptText className="size-3.5" /> Why is this a note?</DButton>}
              >
                <strong className="mono">{line.noteText}</strong>
                <div className="row-sub"><PluginChip name={installationName(overview, line.installationId)} /><Badge tone="info">text item</Badge></div>
                <p className="row-reason">Replaces <b>{line.productName}</b>.</p>
              </RowItem>
            ))}
          </RowList>
        )}
      </Panel>

      <PausedLines overview={overview} reload={reload} />
    </>
  );
}
