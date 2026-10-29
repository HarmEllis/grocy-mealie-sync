'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppBadge } from '@/components/redesign/primitives';
import { ThemedSelect } from '@/components/shared/ThemedSelect';
import { apiJson } from '../api';
import { MappingEditor, type MappingRow, type ProductRow } from '../MappingEditor';
import { money, REVIEW_LABELS, when } from '../shop-common';
import { DataRow, DataTable, EmptyState, Panel, Spinner } from '../shop-ui';
import type { ShopOverview } from '@/lib/shop/overview';
import { post } from '../shop-common';

export function ReceiptsTab({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  const [installationId, setInstallationId] = useState(overview.installations[0]?.id ?? '');
  const [historyLimit, setHistoryLimit] = useState<5 | 10>(5);
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState<{ providerId: string; product: ProductRow; mapping: MappingRow | null } | null>(null);
  return (
    <div className="space-y-4">
      <Panel
        title="Receipts"
        subtitle="Reference-only receipts help configure mappings. They never book stock or check off shopping items, even after processing is enabled."
        tools={<Button size="sm" variant="outline" onClick={async () => { if (await post('/api/shop/receipts/pull', {}, 'Receipt pull requested')) window.setTimeout(() => void reload(), 3000); }}>Pull receipts now</Button>}
      >
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 md:px-5">
          <ThemedSelect ariaLabel="Receipt retailer" value={installationId} onChange={setInstallationId} options={overview.installations.map(item => ({ value: item.id, label: item.name }))} className="w-full sm:w-56" />
          <ThemedSelect ariaLabel="Historical receipt count" value={historyLimit} onChange={setHistoryLimit} options={[{ value: 5, label: 'Latest 5 receipts' }, { value: 10, label: 'Latest 10 receipts' }]} className="w-full sm:w-48" />
          <Button size="sm" variant="outline" disabled={!installationId || fetching} onClick={async () => {
            setFetching(true);
            try {
              const result = await apiJson<{ imported: number; activeSkipped: number; catalogueWarning: string | null }>('/api/shop/receipts/history', { method: 'POST', body: JSON.stringify({ installationId, limit: historyLimit }) });
              toast.success(`${result.imported} receipt(s) loaded for setup`, { description: result.activeSkipped ? `${result.activeSkipped} recent purchase(s) remain for normal processing. Use Pull receipts now to retrieve them.` : undefined });
              if (result.catalogueWarning) toast.warning(result.catalogueWarning);
              await reload();
            } catch (error) { toast.error('Could not load receipts', { description: (error as Error).message }); }
            finally { setFetching(false); }
          }}>{fetching ? <><Spinner /> Loading receipts…</> : 'Load receipts for setup'}</Button>
        </div>
      </Panel>
      {editing ? <MappingEditor {...editing} onClose={() => { setEditing(null); void reload(); }} /> : null}
      {overview.receipts.length === 0 ? <Panel title="No receipts stored yet"><EmptyState>Pull receipts, or load a few for setup, to build a reference history.</EmptyState></Panel> : null}
      {overview.receipts.map(receipt => (
        <Panel
          key={receipt.id}
          title={`${when(receipt.purchasedAt)} ${receipt.storeLabel ?? ''}`}
          subtitle={`Status: ${receipt.referenceOnly ? 'Reference only, setup' : receipt.status.replaceAll('_', ' ')}${receipt.totalCents !== null ? ` · total ${money(receipt.totalCents)}` : ''}`}
        >
          {receipt.lines.length === 0 ? <EmptyState>Bought before receipt processing was enabled; kept as a header only.</EmptyState> : (
            <DataTable headers={['Line', 'Qty', 'Amount', 'Status', 'Attribution']}>
              {receipt.lines.map(line => (
                <DataRow key={line.id} cells={[
                  ['Line', <div key="l" className="space-y-1">
                    <p>{line.description}</p>
                    {line.mapping ? <p className="text-xs text-muted-foreground">Mapped to {line.mapping.targetName} · {line.mapping.packageBaseAmount ?? '?'} {line.mapping.packageBaseUnitName ?? 'units'} per package</p> : null}
                    {line.retailerProductId && receipt.providerId ? <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const data = await apiJson<{ products: ProductRow[]; mappings: MappingRow[] }>(`/api/shop/mappings?providerId=${encodeURIComponent(receipt.providerId)}`);
                        const product = data.products.find(item => item.externalId === line.retailerProductId);
                        if (!product) throw new Error('Receipt product is unavailable');
                        setEditing({ providerId: receipt.providerId, product, mapping: data.mappings.find(item => item.retailerProductId === line.retailerProductId) ?? null });
                      } catch (error) { toast.error('Could not open mapping', { description: (error as Error).message }); }
                    }}>{line.mapping ? 'Change mapping' : 'Map product'}</Button> : null}
                  </div>],
                  ['Qty', <span key="q" className="font-mono">{line.quantity} {line.unit}</span>],
                  ['Amount', <span key="a" className="font-mono">{money(line.amountCents)}</span>],
                  ['Status', <div key="s" className="space-y-1">
                    <AppBadge small tone={line.reviewReason ? 'warning' : 'default'}>{line.status}</AppBadge>
                    {line.reviewReason ? <p className="text-xs text-text-2">{REVIEW_LABELS[line.reviewReason] ?? line.reviewReason}</p> : null}
                  </div>],
                  ['Attribution', <span key="t" className="text-xs text-muted-foreground">{line.links.map(link => `${link.kind} ${Math.round(link.baseAmount * 1000) / 1000}`).join(', ')}</span>],
                ]} />
              ))}
            </DataTable>
          )}
        </Panel>
      ))}
    </div>
  );
}
