'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppBadge, AppInput } from '@/components/redesign/primitives';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { apiJson } from '../api';
import { money, post, REVIEW_LABELS, when } from '../shop-common';
import type { ShopOverview } from '@/lib/shop/overview';
import type { TargetOption } from '@/lib/shop/targets';
import { EmptyState, Panel, RowItem, RowList } from '../shop-ui';
import { ProjectionReview } from './ProjectionReview';

export function ReviewGroup({ title, subtitle, count, icon, children }: { title: string; subtitle: string; count: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <Panel
      title={title}
      icon={icon}
      subtitle={subtitle}
      tools={count > 0 ? <AppBadge small tone="warning">{count}</AppBadge> : <AppBadge small tone="success">clear</AppBadge>}
    >
      {children}
    </Panel>
  );
}

export function ReviewTab({ overview, reload }: { overview: ShopOverview; reload: () => Promise<void> }) {
  const clear = overview.review.length === 0 && overview.discrepancies.length === 0 && overview.effects.length === 0 && (overview.projectionReview ?? []).length === 0;
  return (
    <div className="space-y-4">
      {clear ? <EmptyState title="Nothing needs your decision." tone="good">Every receipt line is settled, no write is waiting and no shopping row is blocked.</EmptyState> : null}
      <ProjectionReview overview={overview} />
      <ReviewGroup title="Receipt lines to review" count={overview.review.length} subtitle="Nothing here was booked. Map the product, confirm a one-off substitution, or dismiss the line.">
        {overview.review.length === 0 ? <EmptyState>Nothing to review.</EmptyState> : (
          <RowList>
            {overview.review.map(line => <ReviewLine key={line.id} line={line} overview={overview} reload={reload} />)}
          </RowList>
        )}
      </ReviewGroup>

      <ReviewGroup title="Stock discrepancies" count={overview.discrepancies.length} subtitle="A manual check booked something that differs from what the receipt shows.">
        {overview.discrepancies.length === 0 ? <EmptyState>No open discrepancies.</EmptyState> : (
          <RowList>
            {overview.discrepancies.map(discrepancy => <DiscrepancyItem key={discrepancy.id} discrepancy={discrepancy} reload={reload} />)}
          </RowList>
        )}
      </ReviewGroup>

      <ReviewGroup title="Writes needing a decision" count={overview.effects.length} subtitle="These writes have an unknown outcome or failed. They are never retried automatically.">
        {overview.effects.length === 0 ? <EmptyState>All writes are settled.</EmptyState> : (
          <RowList>
            {overview.effects.map(effect => (
              <RowItem
                key={effect.id}
                testId="uncertain-effect"
                actions={<>
                  {effect.status === 'unknown' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/effects/${effect.id}`, { action: 'booked_elsewhere' }, 'Marked as done')) await reload(); }}>It happened</Button>
                      <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/effects/${effect.id}`, { action: 'not_booked_retry' }, 'Will retry once')) await reload(); }}>It did not happen, retry</Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/effects/${effect.id}`, { action: 'skip' }, 'Skipped')) await reload(); }}>Skip</Button>
                </>}
              >
                <div>
                  <span className="font-semibold">{String((effect.payload as { label?: string }).label ?? effect.kind)}</span>{' '}
                  <AppBadge small tone={effect.status === 'unknown' ? 'warning' : 'error'}>{effect.status.replace('_', ' ')}</AppBadge>{' '}
                  <span className="text-xs text-muted-foreground">{effect.kind} · {effect.sourceKind} · attempts {effect.attempts}</span>
                </div>
                {effect.error ? <div className="text-xs text-muted-foreground">Last error: {effect.error}</div> : null}
                {effect.evidence ? <Evidence value={effect.evidence} /> : null}
              </RowItem>
            ))}
          </RowList>
        )}
      </ReviewGroup>
    </div>
  );
}

/** Readable key/value view of stored evidence, in place of raw JSON. */
function Evidence({ value }: { value: unknown }) {
  const entries = value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : [['evidence', value] as [string, unknown]];
  return (
    <dl className="grid gap-x-4 gap-y-0.5 rounded-md bg-bg-3/40 p-2 font-mono text-[11px] sm:grid-cols-[max-content_1fr]">
      {entries.map(([key, entry]) => (
        <div key={key} className="contents">
          <dt className="text-text-2">{key}</dt>
          <dd className="min-w-0 break-words">{typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean' ? String(entry) : JSON.stringify(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewLine({ line, overview, reload }: { line: ShopOverview['review'][number]; overview: ShopOverview; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [productId, setProductId] = useState('');
  const [stockAmount, setStockAmount] = useState('');
  const [rows, setRows] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [remember, setRemember] = useState(false);
  const [fulfilOnly, setFulfilOnly] = useState(false);

  async function loadTargets() {
    try {
      const result = await apiJson<{ targets: TargetOption[] }>(`/api/shop/targets?query=${encodeURIComponent(line.description)}`);
      setTargets(result.targets.filter(target => target.kind === 'grocy_product'));
    } catch (error) {
      toast.error('Search failed', { description: (error as Error).message });
    }
  }

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter(entry => entry !== value) : [...list, value]);
  const selectedProduct = targets.find(target => target.id === productId);

  return (
    <li className="space-y-2 px-4 py-3 text-sm md:px-5" data-testid="review-line">
      <div>
        <span className="font-semibold">{line.description}</span> · {line.quantity} {line.unit} {line.amountCents !== null ? `· ${money(line.amountCents)}` : ''} ·{' '}
        <span className="text-muted-foreground">{REVIEW_LABELS[line.reviewReason ?? ''] ?? line.reviewReason}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { setOpen(!open); if (!open) void loadTargets(); }}>One-off substitution</Button>
        <Button size="sm" variant="outline" onClick={async () => { if (await post(`/api/shop/review/${line.id}`, { action: 'requeue' }, 'Line will be processed again')) await reload(); }}>Process again (after mapping)</Button>
        <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/review/${line.id}`, { action: 'dismiss' }, 'Line dismissed')) await reload(); }}>Dismiss</Button>
      </div>
      {open ? (
        <div className="space-y-2 rounded bg-bg-3/40 p-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={fulfilOnly} onChange={event => setFulfilOnly(event.target.checked)} /> Fulfil demand only, book nothing in Grocy</label>
          {!fulfilOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <SearchableSelect className="w-full sm:w-64" ariaLabel="Product actually bought" placeholder="Grocy product actually bought…" value={productId || null} onChange={value => setProductId(value ?? '')} options={targets.map(target => ({ value: target.id, label: `${target.name} (${target.baseUnitName ?? 'stock unit'})` }))} />
              <AppInput className="w-28" value={stockAmount} onChange={event => setStockAmount(event.target.value)} placeholder="Stock amount" inputMode="decimal" aria-label="Stock amount" />
              <label className="flex items-center gap-1"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /> Remember as alternative</label>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">Open shopping rows this purchase fulfils (they are removed):</p>
            {overview.openDemand.map(row => (
              <label key={row.mealieItemId} className="mr-3 inline-flex items-center gap-1">
                <input type="checkbox" checked={rows.includes(row.mealieItemId)} onChange={() => setRows(toggle(rows, row.mealieItemId))} /> {row.label} ({row.quantity})
              </label>
            ))}
          </div>
          {overview.recentChecks.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Rows you already checked off for this purchase (their original booking is flagged for review):</p>
              {overview.recentChecks.slice(0, 15).map(check => (
                <label key={check.id} className="mr-3 inline-flex items-center gap-1">
                  <input type="checkbox" checked={checks.includes(check.id)} onChange={() => setChecks(toggle(checks, check.id))} /> product #{check.grocyProductId} · {when(check.checkedObservedAt)}
                </label>
              ))}
            </div>
          ) : null}
          <Button
            size="sm"
            disabled={!fulfilOnly && (!productId || !(Number(stockAmount) > 0))}
            onClick={async () => {
              const body = {
                action: 'substitute',
                bookGrocyProductId: fulfilOnly ? null : Number(productId),
                bookGrocyProductName: fulfilOnly ? undefined : selectedProduct?.name,
                stockAmount: fulfilOnly ? null : Number(stockAmount),
                mealieItemIds: rows,
                lifecycleIds: checks,
                rememberAsAlternative: !fulfilOnly && remember,
              };
              if (await post(`/api/shop/review/${line.id}`, body, 'Substitution confirmed')) await reload();
            }}
          >
            Confirm substitution
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function DiscrepancyItem({ discrepancy, reload }: { discrepancy: ShopOverview['discrepancies'][number]; reload: () => Promise<void> }) {
  const evidence = (discrepancy.evidence ?? {}) as {
    bookedAmount?: number;
    receiptAmount?: number;
    productId?: number;
    bookings?: Array<{ productId: number; amount: number; transactionId: string | null }>;
    receiptLine?: { description?: string };
  };
  const [amount, setAmount] = useState(
    evidence.bookedAmount !== undefined && evidence.receiptAmount !== undefined ? String(Math.max(0, evidence.bookedAmount - evidence.receiptAmount)) : '',
  );
  const productId = evidence.productId ?? evidence.bookings?.[0]?.productId;
  if (discrepancy.kind === 'check_after_receipt') {
    return (
      <li className="space-y-2 px-4 py-3 text-sm md:px-5" data-testid="discrepancy">
        <div className="font-semibold">A shopping row was checked off while a receipt was already fulfilling it. Nothing was booked for the check yet.</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'skip_check' }, 'The receipt covers it; the check books nothing')) await reload();
          }}>The receipt covers it</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'book_check' }, 'The check will be booked as an extra purchase')) await reload();
          }}>It was an additional purchase, book it</Button>
        </div>
      </li>
    );
  }
  return (
    <li className="space-y-2 px-4 py-3 text-sm md:px-5" data-testid="discrepancy">
      <div className="font-semibold">
        {discrepancy.kind === 'over_booked_manual_check'
          ? `A manual check booked ${evidence.bookedAmount}, the receipt shows ${evidence.receiptAmount}.`
          : `A substitute was bought, but the original product was already booked${evidence.receiptLine?.description ? ` (${evidence.receiptLine.description})` : ''}.`}
      </div>
      {(evidence.bookings ?? []).length ? (
        <ul className="space-y-0.5 rounded-md bg-bg-3/40 p-2 font-mono text-[11px]">
          {(evidence.bookings ?? []).map((booking, index) => (
            <li key={booking.transactionId ?? index}>product #{booking.productId} · amount {booking.amount}{booking.transactionId ? ` · transaction ${booking.transactionId}` : ''}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {(evidence.bookings ?? []).filter(booking => booking.transactionId).map(booking => (
          <Button key={booking.transactionId} size="sm" variant="outline" onClick={async () => {
            if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'undo_transaction', transactionId: booking.transactionId }, 'Booking undone')) await reload();
          }}>Undo booking {booking.transactionId}</Button>
        ))}
        {productId ? (
          <>
            <AppInput className="w-20" value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" aria-label="Amount to consume" />
            <Button size="sm" variant="outline" disabled={!(Number(amount) > 0)} onClick={async () => {
              if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'consume_difference', productId, amount: Number(amount) }, 'Difference consumed')) await reload();
            }}>Consume difference</Button>
          </>
        ) : null}
        <Button size="sm" variant="ghost" onClick={async () => { if (await post(`/api/shop/discrepancies/${discrepancy.id}`, { action: 'keep_stock' }, 'Stock kept as is')) await reload(); }}>Keep stock as is</Button>
      </div>
    </li>
  );
}
