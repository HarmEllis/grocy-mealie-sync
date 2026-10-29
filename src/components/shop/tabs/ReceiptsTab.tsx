'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Link2, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiJson } from '../api';
import { MappingEditor, type MappingRow, type ProductRow } from '../MappingEditor';
import { ThemedSelect } from '@/components/shared/ThemedSelect';
import { installationName, money, post, REVIEW_LABELS } from '../shop-common';
import { useWhen } from '../shop-format';
import { Badge, CheckLine, DButton, EmptyState, ErrorBar, Panel, ShopLogo, Spinner } from '../shop-ui';
import type { ShopOverview } from '@/lib/shop/overview';

type ReceiptView = ShopOverview['receipts'][number];

function statusTone(receipt: ReceiptView): 'success' | 'warning' | '' {
  if (receipt.referenceOnly) return '';
  return receipt.status === 'processed' || receipt.status === 'booked' ? 'success' : 'warning';
}

export function ReceiptsTab({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  const when = useWhen();
  const receiptPlugins = overview.installations.filter(installation => installation.capabilities.includes('receipts') || installation.settings.receiptsEnabled);
  const retailers = receiptPlugins.length ? receiptPlugins : overview.installations;
  const [retailer, setRetailer] = useState('all');
  const [historyLimit, setHistoryLimit] = useState<'5' | '10'>('5');
  const [onlyToMap, setOnlyToMap] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [editing, setEditing] = useState<{ providerId: string; product: ProductRow; mapping: MappingRow | null } | null>(null);
  const reloadTimer = useRef<number | null>(null);
  useEffect(() => () => { if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current); }, []);

  // Loading history for setup needs one installation: the only retailer counts as selected.
  const selected = retailers.find(installation => installation.id === retailer) ?? (retailer === 'all' && retailers.length === 1 ? retailers[0] : undefined);
  const visible = overview.receipts
    // A receipt belongs to one installation; the provider only stands in when its installation is gone.
    .filter(receipt => retailer === 'all' || receipt.installationId === retailer
      || (selected?.providerId && receipt.providerId === selected.providerId && !overview.installations.some(installation => installation.id === receipt.installationId)))
    .map(receipt => ({ receipt, lines: onlyToMap ? receipt.lines.filter(line => !line.mapping && line.retailerProductId) : receipt.lines }))
    .filter(({ receipt, lines }) => !onlyToMap || (receipt.lines.length > 0 && lines.length > 0));
  const failing = overview.installations.filter(installation => installation.settings.receiptsEnabled && installation.receiptCursor?.lastError);

  async function pull() {
    setPulling(true);
    try {
      if (await post('/api/shop/receipts/pull', {}, 'Receipt pull requested')) {
        if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
        reloadTimer.current = window.setTimeout(() => void reload(), 3000);
      }
    } finally {
      setPulling(false);
    }
  }

  async function loadForSetup() {
    if (!selected) return;
    setFetching(true);
    try {
      const result = await apiJson<{ imported: number; activeSkipped: number; catalogueWarning: string | null }>('/api/shop/receipts/history', { method: 'POST', body: JSON.stringify({ installationId: selected.id, limit: Number(historyLimit) }) });
      toast.success(`${result.imported} receipt(s) loaded for setup`, { description: result.activeSkipped ? `${result.activeSkipped} recent purchase(s) remain for normal processing. Use Pull receipts now to retrieve them.` : undefined });
      if (result.catalogueWarning) toast.warning(result.catalogueWarning);
      await reload();
    } catch (error) {
      toast.error('Could not load receipts', { description: (error as Error).message });
    } finally {
      setFetching(false);
    }
  }

  async function openMapping(receipt: ReceiptView, retailerProductId: string) {
    try {
      const data = await apiJson<{ products: ProductRow[]; mappings: MappingRow[] }>(`/api/shop/mappings?providerId=${encodeURIComponent(receipt.providerId)}`);
      const product = data.products.find(item => item.externalId === retailerProductId);
      if (!product) throw new Error('Receipt product is unavailable');
      setEditing({ providerId: receipt.providerId, product, mapping: data.mappings.find(item => item.retailerProductId === retailerProductId) ?? null });
    } catch (error) {
      toast.error('Could not open mapping', { description: (error as Error).message });
    }
  }

  return (
    <>
      <Panel
        testId="panel-receipt-pull"
        icon={<Receipt className="size-4" />}
        title="Receipts"
        subtitle="Receipts pulled from the retailer are processed while receipt processing is enabled. Receipts loaded for setup are reference only: they help you configure mappings and never book stock or check items off a list."
        tools={<DButton onClick={() => void pull()} disabled={pulling} data-testid="pull-receipts">{pulling ? <Spinner /> : <ArrowLeftRight className="size-3.5" />} Pull receipts now</DButton>}
        footer={<span>Mapping a line here only teaches gm-sync which product the retailer text means. It does not book anything.</span>}
      >
        {failing.length ? (
          <div style={{ padding: '18px 20px 0', display: 'grid', gap: 10 }}>
            {failing.map(installation => (
              <ErrorBar key={installation.id} title={`${installation.name}: the last receipt check failed`} action={<DButton onClick={() => void pull()}><ArrowLeftRight className="size-3.5" /> Try this retailer again</DButton>}>
                {installation.receiptCursor?.lastError}
              </ErrorBar>
            ))}
          </div>
        ) : null}
        <div className="receipt-controls">
          <div className="field">
            <span>Retailer</span>
            <ThemedSelect ariaLabel="Receipt retailer" value={retailer} onChange={setRetailer} className="w-full" options={[{ value: 'all', label: 'All retailers' }, ...retailers.map(installation => ({ value: installation.id, label: installation.name }))]} />
          </div>
          <div className="field">
            <span>How many</span>
            <ThemedSelect ariaLabel="Historical receipt count" value={historyLimit} onChange={setHistoryLimit} className="w-full" options={[{ value: '5' as const, label: 'Latest 5 receipts' }, { value: '10' as const, label: 'Latest 10 receipts' }]} />
          </div>
          <div className="field field-actions">
            <DButton disabled={!selected || fetching} onClick={() => void loadForSetup()} title={selected ? undefined : 'Choose one retailer to load receipts for setup'}>
              {fetching ? <Spinner /> : <Receipt className="size-3.5" />} {fetching ? 'Loading receipts…' : 'Load receipts for setup'}
            </DButton>
          </div>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <CheckLine checked={onlyToMap} onChange={setOnlyToMap}>Show only lines that still need a product mapping</CheckLine>
        </div>
        {fetching ? (
          <div className="skeleton" aria-hidden="true"><div className="sk w40" /><div className="sk" /><div className="sk w80" /><div className="sk w60" /></div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<Receipt className="size-5" />} title={onlyToMap ? 'No lines need a mapping' : 'No receipts stored yet'}>
            {onlyToMap ? 'Every receipt line with a retailer product is mapped.' : 'Pull receipts, or load a few for setup, to build up a history. Receipts loaded for setup are reference only and never book stock or check items off.'}
          </EmptyState>
        ) : (
          <div className="rcards" style={{ padding: '0 20px 18px' }}>
            {visible.map(({ receipt, lines }) => (
              <article key={receipt.id} className="rcard" data-testid="receipt">
                <div className="rcard-head">
                  <ShopLogo name={installationName(overview, receipt.installationId)} />
                  <div className="rcard-id">
                    <strong>{receipt.storeLabel ?? installationName(overview, receipt.installationId)}</strong>
                    <small>{when(receipt.purchasedAt)}</small>
                  </div>
                  <Badge tone={statusTone(receipt)}>{receipt.referenceOnly ? 'Reference only, setup' : receipt.status.replaceAll('_', ' ')}</Badge>
                  {receipt.totalCents !== null ? <span className="rcard-total">{money(receipt.totalCents)}</span> : null}
                </div>
                {receipt.lines.length === 0 ? (
                  <div className="state" style={{ padding: 24 }}><p>Bought before receipt processing was enabled; kept as a header only.</p></div>
                ) : (
                  <div className="rlines">
                    {lines.map(line => (
                      <div key={line.id} className="rline" data-testid="receipt-line">
                        <div className="rline-main">
                          <div className="rline-desc">{line.description}</div>
                          <div className={`rline-map${line.mapping ? '' : ' unmapped'}`}>
                            {line.mapping ? <Check aria-hidden="true" /> : <Search aria-hidden="true" />}
                            <span>{line.mapping ? `Mapped to ${line.mapping.targetName} · ${line.mapping.packageBaseAmount ?? '?'} ${line.mapping.packageBaseUnitName ?? 'units'} per package` : 'No product mapping yet'}</span>
                          </div>
                          <div className="rline-tags">
                            <Badge tone={line.reviewReason ? 'warning' : ''}>{line.status}</Badge>
                            {line.reviewReason ? <Badge tone="warning">{REVIEW_LABELS[line.reviewReason] ?? line.reviewReason}</Badge> : null}
                            {line.links.map((link, index) => <Badge key={index} tone="info">{link.kind} {Math.round(link.baseAmount * 1000) / 1000}</Badge>)}
                          </div>
                        </div>
                        <div className="rline-right">
                          <span className="rline-qty">{line.quantity} {line.unit}</span>
                          <span className="rline-amount">{money(line.amountCents)}</span>
                          {line.retailerProductId && receipt.providerId ? (
                            <DButton variant="ghost" onClick={() => void openMapping(receipt, line.retailerProductId as string)}>
                              <Link2 className="size-3.5" /> {line.mapping ? 'Change mapping' : 'Map product'}
                            </DButton>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
      {editing ? <MappingEditor {...editing} onClose={() => { setEditing(null); void reload(); }} /> : null}
    </>
  );
}
