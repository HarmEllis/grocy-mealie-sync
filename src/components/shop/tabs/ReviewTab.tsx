'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Check, Clock, Receipt, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { apiJson } from '../api';
import { money, pausedLines, post, REVIEW_LABELS } from '../shop-common';
import { useAction } from '../shop-actions';
import { useWhen } from '../shop-format';
import type { ShopOverview } from '@/lib/shop/overview';
import type { TargetOption } from '@/lib/shop/targets';
import { Badge, CheckLine, DButton, EmptyState, Evidence, Field, ReviewGroup, RowItem, RowList } from '../shop-ui';
import { PausedLines } from './PausedLines';
import { ProjectionRows } from './ProjectionReview';

export function ReviewTab({ overview, reload, openProducts, goTo }: {
  overview: ShopOverview;
  reload: () => Promise<void>;
  openProducts: (query: string) => void;
  goTo: (tab: 'overview') => void;
}) {
  const projection = overview.projectionReview ?? [];
  const clear = overview.review.length === 0 && overview.discrepancies.length === 0 && overview.effects.length === 0
    && projection.length === 0 && pausedLines(overview).length === 0;

  if (clear) {
    return (
      <section className="panel" data-testid="review-clear">
        <EmptyState celebrate title="Nothing needs your decision">
          Every receipt line is settled, every write is confirmed and no shopping row is held back. gm-sync keeps the lists in step on its own.
        </EmptyState>
        <div className="state" style={{ paddingTop: 0 }}>
          <DButton variant="ghost" onClick={() => goTo('overview')}><ArrowLeft className="size-3.5" /> Back to the overview</DButton>
        </div>
      </section>
    );
  }

  return (
    <>
      <ReviewGroup testId="review-projection" title="Not sent to retailer" icon={<TriangleAlert />} count={projection.length}
        intro="Each row is retried automatically on the next sync once its cause is fixed.">
        {projection.length === 0
          ? <EmptyState tone="good" title="No blocked shopping rows reported">The latest projection held no shopping row back.</EmptyState>
          : <ProjectionRows overview={overview} rows={projection} openProducts={openProducts} />}
      </ReviewGroup>

      <ReviewGroup testId="review-lines" title="Receipt lines to review" icon={<Receipt />} count={overview.review.length}
        intro={<><b>Nothing here was booked.</b> Receipts are reference material until you decide what a line means.</>}>
        {overview.review.length === 0
          ? <EmptyState tone="good" title="No receipt lines to review">Every receipt line matched a mapping.</EmptyState>
          : <RowList>{overview.review.map(line => <ReviewLine key={line.id} line={line} overview={overview} reload={reload} />)}</RowList>}
      </ReviewGroup>

      <ReviewGroup testId="review-disc" title="Stock discrepancies" icon={<ArrowLeftRight />} count={overview.discrepancies.length}
        intro="A manual check and a receipt disagree. Pick the version that reflects what is in your kitchen.">
        {overview.discrepancies.length === 0
          ? <EmptyState tone="good" title="No stock discrepancies">Receipts and manual checks agree on every booking.</EmptyState>
          : <RowList>{overview.discrepancies.map(discrepancy => <DiscrepancyItem key={discrepancy.id} discrepancy={discrepancy} reload={reload} />)}</RowList>}
      </ReviewGroup>

      <PausedLines overview={overview} reload={reload} grouped />

      <ReviewGroup testId="review-writes" title="Writes needing a decision" icon={<Clock />} count={overview.effects.length}
        intro="gm-sync never retries an uncertain write on its own: a double write would silently add units to a shared list.">
        {overview.effects.length === 0
          ? <EmptyState tone="good" title="All writes are settled">Nothing is waiting on an uncertain retailer response.</EmptyState>
          : <RowList>
            {overview.effects.map(effect => <EffectItem key={effect.id} effect={effect} reload={reload} />)}
          </RowList>}
      </ReviewGroup>
    </>
  );
}

function EffectItem({ effect, reload }: { effect: ShopOverview['effects'][number]; reload: () => Promise<void> }) {
  const { busy, run } = useAction();
  const resolve = (action: string, success: string) => run(async () => { if (await post(`/api/shop/effects/${effect.id}`, { action }, success)) await reload(); });
  return (
    <RowItem
      testId="uncertain-effect"
      actions={<>
        {/* The backend only accepts these two resolutions for an outcome that is still unknown. */}
        {effect.status === 'unknown' ? <DButton disabled={busy} onClick={() => void resolve('booked_elsewhere', 'Marked as done')}>It happened</DButton> : null}
        {effect.status === 'unknown' ? <DButton disabled={busy} onClick={() => void resolve('not_booked_retry', 'Will retry once')}>It did not happen, retry</DButton> : null}
        <DButton variant="ghost" disabled={busy} onClick={() => void resolve('skip', 'Skipped')}>Skip</DButton>
      </>}
    >
      <strong>{String((effect.payload as { label?: string }).label ?? effect.kind)}</strong>
      <div className="row-sub">
        <Badge tone={effect.status === 'unknown' ? 'warning' : 'danger'}>{effect.status.replace('_', ' ')}</Badge>
        <Badge tone="info">{effect.kind}</Badge>
        <span>{effect.sourceKind}</span>
        <span className="mono">{effect.attempts} attempt{effect.attempts === 1 ? '' : 's'}</span>
      </div>
      {effect.error ? <p className="row-reason">{effect.error}</p> : null}
      {effect.evidence ? <Evidence rows={evidenceRows(effect.evidence)} /> : null}
    </RowItem>
  );
}

/** Readable key/value rows for stored evidence, in place of raw JSON. */
function evidenceRows(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [['evidence', String(value)]];
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, typeof entry === 'object' && entry !== null ? JSON.stringify(entry) : String(entry)]);
}

function ReviewLine({ line, overview, reload }: { line: ShopOverview['review'][number]; overview: ShopOverview; reload: () => Promise<void> }) {
  const when = useWhen();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [productId, setProductId] = useState('');
  const [stockAmount, setStockAmount] = useState('');
  const [rows, setRows] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [remember, setRemember] = useState(false);
  const [fulfilOnly, setFulfilOnly] = useState(false);

  const [query, setQuery] = useState('');
  const requestSequence = useRef(0);

  // Suggestions follow the receipt text; typing searches every Grocy product, like the mapping dialog.
  useEffect(() => {
    if (!open) return;
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiJson<{ targets: TargetOption[] }>(`/api/shop/targets?query=${encodeURIComponent(query.slice(0, 200))}&suggestFor=${encodeURIComponent(line.description.slice(0, 200))}`);
        if (sequence !== requestSequence.current) return;
        setTargets(result.targets.filter(target => target.kind === 'grocy_product'));
      } catch (error) {
        if (sequence === requestSequence.current) toast.error('Search failed', { description: (error as Error).message });
      }
    }, query ? 250 : 0);
    return () => { window.clearTimeout(timer); requestSequence.current++; };
  }, [open, query, line.description]);

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter(entry => entry !== value) : [...list, value]);
  const selectedProduct = targets.find(target => target.id === productId);
  // Keep the chosen product visible and bookable after a later search no longer lists it.
  const [selectedMemo, setSelectedMemo] = useState<TargetOption | null>(null);
  const reason = REVIEW_LABELS[line.reviewReason ?? ''] ?? line.reviewReason;

  return (
    <RowItem
      testId="review-line"
      below={open ? (
<div className="subform">
          <h3>One-off substitution for <span className="mono">{line.description}</span></h3>
          <CheckLine checked={fulfilOnly} onChange={setFulfilOnly}>
            <b>Fulfil demand only, book nothing in Grocy.</b> Use this when the purchase covers a recipe but should not change your stock.
          </CheckLine>
          {!fulfilOnly ? (
            <div className="fields">
              <div className="field">
                <span>Grocy product</span>
                <SearchableSelect
                  className="w-full" ariaLabel="Product actually bought" placeholder="Search a Grocy product…" onSearchChange={setQuery}
                  value={productId || null} onChange={value => { setProductId(value ?? ''); setSelectedMemo(targets.find(target => target.id === value) ?? null); }}
                  extraOption={selectedProduct ?? selectedMemo ? { value: productId, label: `${(selectedProduct ?? selectedMemo)!.name} (${(selectedProduct ?? selectedMemo)!.baseUnitName ?? 'stock unit'})` } : null}
                  options={targets.map(target => ({ value: target.id, label: `${target.name} (${target.baseUnitName ?? 'stock unit'})` }))}
                />
              </div>
              <Field label="Stock amount">
                <input type="number" step="any" min="0" inputMode="decimal" placeholder="e.g. 350" aria-label="Stock amount" value={stockAmount} onChange={event => setStockAmount(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {!fulfilOnly ? <CheckLine checked={remember} onChange={setRemember}>Remember as an alternative, so this retailer text maps itself next time.</CheckLine> : null}
          <div className="fields">
            <div className="field">
              <span>Open shopping rows this purchase fulfils</span>
              <div className="pickbox">
                {overview.openDemand.length === 0 ? <span className="subform-note">No open shopping rows.</span> : overview.openDemand.map(row => (
                  <CheckLine key={row.mealieItemId} checked={rows.includes(row.mealieItemId)} onChange={() => setRows(toggle(rows, row.mealieItemId))}>{row.label} ({row.quantity})</CheckLine>
                ))}
              </div>
              <p className="subform-note">Selected rows are removed from the shared list.</p>
            </div>
            {overview.recentChecks.length > 0 ? (
              <div className="field">
                <span>Rows already checked off that this covers</span>
                <div className="pickbox">
                  {overview.recentChecks.slice(0, 15).map(check => (
                    <CheckLine key={check.id} checked={checks.includes(check.id)} onChange={() => setChecks(toggle(checks, check.id))}>product #{check.grocyProductId} · {when(check.checkedObservedAt)}</CheckLine>
                  ))}
                </div>
                <p className="subform-note">Their original booking is flagged for review instead of being changed silently.</p>
              </div>
            ) : null}
          </div>
          <div className="subform-actions">
            <DButton variant="ghost" onClick={() => setOpen(false)}>Cancel</DButton>
            <DButton
              variant="primary"
              disabled={busy || (!fulfilOnly && (!productId || !(Number(stockAmount) > 0)))}
              onClick={() => void run(async () => {
                const body = {
                  action: 'substitute',
                  bookGrocyProductId: fulfilOnly ? null : Number(productId),
                  bookGrocyProductName: fulfilOnly ? undefined : (selectedProduct ?? selectedMemo)?.name,
                  stockAmount: fulfilOnly ? null : Number(stockAmount),
                  mealieItemIds: rows,
                  lifecycleIds: checks,
                  rememberAsAlternative: !fulfilOnly && remember,
                };
                if (await post(`/api/shop/review/${line.id}`, body, 'Substitution confirmed')) await reload();
              })}
            >
              <Check className="size-3.5" /> Confirm substitution
            </DButton>
          </div>
        </div>
      ) : null}
      actions={<>
        <DButton aria-expanded={open} onClick={() => setOpen(!open)}><ArrowLeftRight className="size-3.5" /> One-off substitution</DButton>
        <DButton variant="ghost" disabled={busy} onClick={() => void run(async () => { if (await post(`/api/shop/review/${line.id}`, { action: 'requeue' }, 'Line will be processed again')) await reload(); })}><Clock className="size-3.5" /> Process again (after mapping)</DButton>
        <DButton variant="ghost" disabled={busy} onClick={() => void run(async () => { if (await post(`/api/shop/review/${line.id}`, { action: 'dismiss' }, 'Line dismissed')) await reload(); })}><X className="size-3.5" /> Dismiss</DButton>
      </>}
    >
      <strong className="mono">{line.description}</strong>
      <div className="row-sub">
        <span className="mono">{line.quantity} {line.unit}</span>
        {line.amountCents !== null ? <span className="mono">{money(line.amountCents)}</span> : null}
      </div>
      <div className="row-badges"><Badge tone="warning">{reason}</Badge><Badge>nothing booked</Badge></div>
    </RowItem>
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
  const { busy, run } = useAction();
  const resolve = (body: Record<string, unknown>, success: string) => run(async () => {
    if (await post(`/api/shop/discrepancies/${discrepancy.id}`, body, success)) await reload();
  });

  if (discrepancy.kind === 'check_after_receipt') {
    return (
      <RowItem
        testId="discrepancy"
        actions={<>
          <DButton disabled={busy} onClick={() => void resolve({ action: 'skip_check' }, 'The receipt covers it; the check books nothing')}>The receipt covers it</DButton>
          <DButton variant="ghost" disabled={busy} onClick={() => void resolve({ action: 'book_check' }, 'The check will be booked as an extra purchase')}>It was an additional purchase, book it</DButton>
        </>}
      >
        <strong>A shopping row was checked off while a receipt was already fulfilling it.</strong>
        <div className="row-sub"><Badge tone="danger">stock discrepancy</Badge></div>
        <p className="row-reason">Nothing was booked for the check yet.</p>
      </RowItem>
    );
  }

  const rows: Array<[string, string]> = [];
  if (evidence.receiptLine?.description) rows.push(['Receipt line', evidence.receiptLine.description]);
  if (evidence.bookedAmount !== undefined) rows.push(['Booked amount', String(evidence.bookedAmount)]);
  if (evidence.receiptAmount !== undefined) rows.push(['Receipt amount', String(evidence.receiptAmount)]);
  for (const booking of evidence.bookings ?? []) rows.push([booking.transactionId ? `Booking ${booking.transactionId}` : 'Booking', `product #${booking.productId} · amount ${booking.amount}`]);

  return (
    <RowItem
      testId="discrepancy"
      actions={<>
        {(evidence.bookings ?? []).filter(booking => booking.transactionId).map(booking => (
          <DButton key={booking.transactionId} disabled={busy} onClick={() => void resolve({ action: 'undo_transaction', transactionId: booking.transactionId }, 'Booking undone')}><ArrowLeft className="size-3.5" /> Undo booking {booking.transactionId}</DButton>
        ))}
        {productId ? (
          <>
            <Field label="Consume" className="min-w-[120px]">
              <input type="number" step="any" min="0" inputMode="decimal" aria-label="Amount to consume" value={amount} onChange={event => setAmount(event.target.value)} />
            </Field>
            <DButton disabled={busy || !(Number(amount) > 0)} onClick={() => void resolve({ action: 'consume_difference', productId, amount: Number(amount) }, 'Difference consumed')}>Consume difference</DButton>
          </>
        ) : null}
        <DButton variant="ghost" disabled={busy} onClick={() => void resolve({ action: 'keep_stock' }, 'Stock kept as is')}>Keep stock as is</DButton>
      </>}
    >
      <strong>
        {discrepancy.kind === 'over_booked_manual_check'
          ? `A manual check booked ${evidence.bookedAmount}, the receipt shows ${evidence.receiptAmount}.`
          : `A substitute was bought, but the original product was already booked${evidence.receiptLine?.description ? ` (${evidence.receiptLine.description})` : ''}.`}
      </strong>
      <div className="row-sub"><Badge tone="danger">stock discrepancy</Badge></div>
      {rows.length ? <Evidence rows={rows} /> : null}
    </RowItem>
  );
}

