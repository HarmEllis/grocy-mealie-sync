import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { checkLifecycles, discrepancies, receiptLines, receipts, reconciliationLinks } from '../db/schema';
import type { MealieShoppingItem } from '../mealie/types';
import { getLifecycle, getLifecycleBookings } from './check-lifecycles';
import { rowIdentityOf } from './demand-observer';
import {
  defaultEffectRunnerDeps,
  runGrocyConsumeEffect,
  runGrocyUndoEffect,
  type EffectRunnerDeps,
  type GrocyAddPayload,
  type GrocyConsumePayload,
  type GrocyUndoPayload,
  type MealieReducePayload,
} from './effect-runners';
import { ensureEffect, type EffectStatus } from './ledger';
import { getReceiptLine } from './receipts';
import { getRetailerMapping, upsertRetailerMapping } from './retailer-catalog';

export type DiscrepancyKind = 'over_booked_manual_check' | 'substitution_original_booked' | 'check_after_receipt';
export type DiscrepancyRow = typeof discrepancies.$inferSelect;

export function listDiscrepancies(status: 'open' | 'resolved' | 'all' = 'open'): DiscrepancyRow[] {
  const rows = db.select().from(discrepancies).orderBy(desc(discrepancies.createdAt)).all();
  return status === 'all' ? rows : rows.filter(row => row.status === status);
}

export function getDiscrepancy(id: string): DiscrepancyRow | null {
  return db.select().from(discrepancies).where(eq(discrepancies.id, id)).get() ?? null;
}

export type DiscrepancyResolution =
  | { action: 'undo_transaction'; transactionId: string }
  | { action: 'consume_difference'; productId: number; amount: number }
  | { action: 'keep_stock' }
  /** check_after_receipt: the check was an additional purchase; book it. */
  | { action: 'book_check' }
  /** check_after_receipt: the receipt already covers it; book nothing for the check. */
  | { action: 'skip_check' };

export interface DiscrepancyResolutionResult {
  status: 'resolved' | 'failed' | 'unknown';
  effectStatus?: EffectStatus;
  message?: string;
}

/**
 * Correct stock for a discrepancy. Every correction is its own ledger effect,
 * so an uncertain outcome is visible and never repeated blindly. Run under the
 * sync lock.
 */
export async function resolveDiscrepancy(
  id: string,
  resolution: DiscrepancyResolution,
  deps: EffectRunnerDeps = defaultEffectRunnerDeps,
  now = new Date(),
): Promise<DiscrepancyResolutionResult> {
  const discrepancy = getDiscrepancy(id);
  if (!discrepancy || discrepancy.status !== 'open') return { status: 'failed', message: 'Discrepancy is not open' };

  const finish = (resolutionLabel: string, effectId: string | null) => {
    db.update(discrepancies)
      .set({ status: 'resolved', resolution: resolutionLabel, resolutionEffectId: effectId, resolvedAt: now })
      .where(eq(discrepancies.id, id))
      .run();
  };

  if (resolution.action === 'book_check' || resolution.action === 'skip_check') {
    if (discrepancy.kind !== 'check_after_receipt' || !discrepancy.lifecycleId) {
      return { status: 'failed', message: 'This decision only applies to a check made after a receipt' };
    }
    db.transaction((tx) => {
      tx.update(discrepancies).set({ status: 'resolved', resolution: resolution.action, resolvedAt: now }).where(eq(discrepancies.id, id)).run();
      tx.update(checkLifecycles)
        .set({ status: resolution.action === 'book_check' ? 'retry' : 'skipped', updatedAt: now })
        .where(eq(checkLifecycles.id, discrepancy.lifecycleId!))
        .run();
    });
    return { status: 'resolved' };
  }

  if (resolution.action === 'keep_stock') {
    finish('keep_stock', null);
    return { status: 'resolved' };
  }

  if (resolution.action === 'undo_transaction') {
    const evidenceTransactions = transactionsOf(discrepancy);
    if (!evidenceTransactions.includes(resolution.transactionId)) {
      return { status: 'failed', message: 'The transaction is not part of this discrepancy' };
    }
    const effect = ensureEffect<GrocyUndoPayload>({
      effectKey: `discrepancy:${id}:undo:${resolution.transactionId}`,
      kind: 'grocy_undo',
      sourceKind: 'discrepancy',
      sourceRef: id,
      payload: { transactionId: resolution.transactionId, label: 'Undo manual check booking' },
    }, now);
    const status = await runGrocyUndoEffect(effect, deps);
    return settle(id, status, effect.id, 'undo_transaction', finish);
  }

  if (!(resolution.amount > 0)) return { status: 'failed', message: 'Amount must be positive' };
  const effect = ensureEffect<GrocyConsumePayload>({
    effectKey: `discrepancy:${id}:consume:${resolution.productId}`,
    kind: 'grocy_consume',
    sourceKind: 'discrepancy',
    sourceRef: id,
    payload: { productId: resolution.productId, amount: resolution.amount, label: 'Consume over-booked stock' },
  }, now);
  const status = await runGrocyConsumeEffect(effect, deps);
  return settle(id, status, effect.id, 'consume_difference', finish);
}

function settle(
  discrepancyId: string,
  status: EffectStatus,
  effectId: string,
  label: string,
  finish: (label: string, effectId: string | null) => void,
): DiscrepancyResolutionResult {
  if (status === 'applied') {
    finish(label, effectId);
    return { status: 'resolved', effectStatus: status };
  }
  if (status === 'unknown') {
    db.update(discrepancies).set({ resolutionEffectId: effectId }).where(eq(discrepancies.id, discrepancyId)).run();
    return { status: 'unknown', effectStatus: status, message: 'The correction has an unknown outcome; check Grocy and resolve the effect.' };
  }
  return { status: 'failed', effectStatus: status, message: 'Grocy rejected the correction. Nothing was changed.' };
}

function transactionsOf(discrepancy: DiscrepancyRow): string[] {
  try {
    const evidence = JSON.parse(discrepancy.evidenceJson) as { bookings?: Array<{ transactionId?: string | null }> };
    return (evidence.bookings ?? []).map(booking => booking.transactionId).filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// One-off substitutions
// ---------------------------------------------------------------------------

export interface SubstitutionInput {
  receiptLineId: string;
  /** Grocy product actually bought; null means "fulfil demand only, book nothing". */
  bookGrocyProductId: number | null;
  bookGrocyProductName?: string;
  /** Stock amount (Grocy stock unit) to book for the whole line. */
  stockAmount: number | null;
  /** Open Mealie rows this purchase fulfils; they are removed. */
  mealieItemIds: string[];
  /** Manual-check lifecycles that already booked the original product for this purchase. */
  lifecycleIds: string[];
  /** Only when ticked does the substitute become a remembered alternative. */
  rememberAsAlternative: boolean;
  /** Current Grocy stock unit of the booked product, required to remember the alternative. */
  bookBaseUnit?: { id: string; name: string | null } | null;
  shoppingListId: string;
}

export interface SubstitutionResult {
  ok: boolean;
  message?: string;
  discrepancies: number;
}

/**
 * Confirm a one-off substitution for a receipt line under review. It books
 * only what was actually bought, fulfils the chosen demand, and raises a
 * discrepancy when a manual check already booked the original product.
 * Effects are executed by the reconciliation worker.
 */
export function substituteReceiptLine(input: SubstitutionInput, liveItems: MealieShoppingItem[], now = new Date()): SubstitutionResult {
  const line = getReceiptLine(input.receiptLineId);
  if (!line || line.status !== 'review') return { ok: false, message: 'Only receipt lines under review can be substituted', discrepancies: 0 };
  const receipt = db.select().from(receipts).where(eq(receipts.id, line.receiptId)).get();
  if (!receipt) return { ok: false, message: 'Receipt not found', discrepancies: 0 };
  if (input.bookGrocyProductId !== null && !(input.stockAmount && input.stockAmount > 0)) {
    return { ok: false, message: 'Enter the stock amount that was bought', discrepancies: 0 };
  }
  const itemsById = new Map(liveItems.map(item => [item.id, item]));
  for (const itemId of input.mealieItemIds) {
    const item = itemsById.get(itemId);
    if (!item || item.checked) return { ok: false, message: 'A chosen shopping row is no longer open', discrepancies: 0 };
  }

  let raised = 0;
  db.transaction((tx) => {
    let addEffectId: string | null = null;
    if (input.bookGrocyProductId !== null && input.stockAmount) {
      const effect = ensureEffect<GrocyAddPayload>({
        effectKey: `substitution:${line.id}:grocy_add`,
        kind: 'grocy_add',
        sourceKind: 'substitution',
        sourceRef: receipt.id,
        payload: {
          productId: input.bookGrocyProductId,
          amount: input.stockAmount,
          ...(line.amountCents !== null ? { price: Math.round(line.amountCents / input.stockAmount) / 100 } : {}),
          label: input.bookGrocyProductName ?? `Product #${input.bookGrocyProductId}`,
        },
      }, now, tx);
      addEffectId = effect.id;
      tx.insert(reconciliationLinks).values({
        id: randomUUID(), receiptLineId: line.id, kind: 'substitution', targetKind: 'grocy_product',
        targetId: String(input.bookGrocyProductId), baseAmount: input.stockAmount, effectId: effect.id, createdAt: now,
      }).run();
    }
    for (const itemId of input.mealieItemIds) {
      const item = itemsById.get(itemId)!;
      const quantity = Number(item.quantity ?? 0) > 0 ? Number(item.quantity) : 1;
      const effect = ensureEffect<MealieReducePayload & { dependsOnEffects: string[] }>({
        effectKey: `substitution:${line.id}:mealie_reduce:${itemId}`,
        kind: 'mealie_reduce',
        sourceKind: 'substitution',
        sourceRef: receipt.id,
        payload: {
          itemId,
          shoppingListId: input.shoppingListId,
          expectedBefore: quantity,
          expectedAfter: 0,
          expectedIdentity: rowIdentityOf(item),
          dependsOnEffects: addEffectId ? [addEffectId] : [],
          label: item.food?.name ?? item.display ?? itemId,
        },
      }, now, tx);
      tx.insert(reconciliationLinks).values({
        id: randomUUID(), receiptLineId: line.id, kind: 'substitution', mealieItemId: itemId,
        baseAmount: quantity, effectId: effect.id, createdAt: now,
      }).run();
    }
    for (const lifecycleId of input.lifecycleIds) {
      const lifecycle = getLifecycle(lifecycleId);
      if (!lifecycle) continue;
      const bookings = getLifecycleBookings(lifecycleId).filter(booking => booking.status === 'applied');
      if (bookings.length === 0) continue;
      // The original product was booked by the manual check, but something else was bought.
      const inserted = tx.insert(discrepancies).values({
        id: randomUUID(),
        kind: 'substitution_original_booked',
        status: 'open',
        receiptLineId: line.id,
        lifecycleId,
        evidenceJson: JSON.stringify({
          receiptId: receipt.id,
          externalReceiptId: receipt.externalReceiptId,
          receiptLine: { description: line.description, quantity: line.quantity, unit: line.unit },
          mealieItemId: lifecycle.mealieItemId,
          bookings,
          substituteProductId: input.bookGrocyProductId,
        }),
        createdAt: now,
      }).onConflictDoNothing().run();
      raised += inserted.changes;
    }
    tx.update(receiptLines).set({ status: 'substituted', reviewReason: null }).where(eq(receiptLines.id, line.id)).run();
    tx.update(receipts).set({ status: 'planned' }).where(eq(receipts.id, receipt.id)).run();
  });

  if (input.rememberAsAlternative && input.bookBaseUnit && line.retailerProductId && input.bookGrocyProductId !== null && input.stockAmount && line.quantity > 0) {
    const existing = getRetailerMapping(receipt.providerId, line.retailerProductId);
    if (!existing) {
      upsertRetailerMapping({
        providerId: receipt.providerId,
        retailerProductId: line.retailerProductId,
        targetKind: 'grocy_product',
        targetId: String(input.bookGrocyProductId),
        targetName: input.bookGrocyProductName ?? `Product #${input.bookGrocyProductId}`,
        role: 'alternative',
        baseUnitId: input.bookBaseUnit.id,
        baseUnitName: input.bookBaseUnit.name,
        packageBaseAmount: input.stockAmount / line.quantity,
        confirm: true,
      }, now);
    }
  }
  return { ok: true, discrepancies: raised };
}

/** Mark a review line as handled without booking anything (for example a non-food item). */
export function dismissReceiptLine(receiptLineId: string): boolean {
  const result = db.update(receiptLines)
    .set({ status: 'ignored', reviewReason: 'dismissed' })
    .where(and(eq(receiptLines.id, receiptLineId), eq(receiptLines.status, 'review')))
    .run();
  if (result.changes === 0) return false;
  const line = getReceiptLine(receiptLineId);
  if (line) {
    const stillReview = db.select().from(receiptLines).where(and(eq(receiptLines.receiptId, line.receiptId), eq(receiptLines.status, 'review'))).all();
    if (stillReview.length === 0) {
      db.update(receipts).set({ status: 'planned' }).where(and(eq(receipts.id, line.receiptId), eq(receipts.status, 'needs_review'))).run();
    }
  }
  return true;
}

/** Re-plan a review line after its mapping was confirmed. */
export function requeueReceiptLine(receiptLineId: string): boolean {
  const line = getReceiptLine(receiptLineId);
  if (!line || line.status !== 'review') return false;
  db.transaction((tx) => {
    tx.update(receiptLines).set({ status: 'pending', reviewReason: null }).where(eq(receiptLines.id, receiptLineId)).run();
    tx.update(receipts).set({ status: 'stored' }).where(eq(receipts.id, line.receiptId)).run();
  });
  return true;
}
