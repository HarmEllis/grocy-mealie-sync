import { randomUUID } from 'crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import { checkLifecycles, demands, discrepancies } from '../db/schema';
import type { StockLogEntry } from '../grocy/types';
import { addProductStock } from '../grocy/types';
import {
  CheckDeferredError,
  completeEffect,
  ensureEffect,
  ensureLedgerActivated,
  getEffect,
  listEffects,
  recoverInterruptedEffects,
  UncertainWriteError,
  type ShopEffect,
} from './ledger';
import {
  defaultEffectRunnerDeps,
  runGrocyAddEffect,
  verifyGrocyAddEffect,
  type EffectRunnerDeps,
  type GrocyAddPayload,
} from './effect-runners';

/**
 * A check lifecycle is one observed "checked" transition of a Mealie row. Its
 * stable ID is reused across failures and retries, so every Grocy booking
 * made for the check is keyed by (lifecycle, actual child product) and can be
 * attributed precisely when a receipt arrives later.
 */

export type CheckLifecycleStatus = 'processing' | 'completed' | 'failed' | 'blocked' | 'retry' | 'skipped' | 'cancelled';
const OPEN_STATUSES: CheckLifecycleStatus[] = ['processing', 'failed', 'blocked', 'retry'];

export type CheckLifecycleRow = typeof checkLifecycles.$inferSelect;

export interface CheckItemRef {
  id: string;
  foodId?: string | null;
  quantity?: number | null;
}

export function findOpenLifecycle(mealieItemId: string): CheckLifecycleRow | null {
  return db.select().from(checkLifecycles)
    .where(and(eq(checkLifecycles.mealieItemId, mealieItemId), inArray(checkLifecycles.status, OPEN_STATUSES)))
    .get() ?? null;
}

/** Return the open lifecycle for this row or start a new one. */
export function openCheckLifecycle(item: CheckItemRef, grocyProductId: number | null, now = new Date()): CheckLifecycleRow {
  ensureLedgerActivated(now);
  const existing = findOpenLifecycle(item.id);
  if (existing) {
    db.update(checkLifecycles)
      .set({ status: 'processing', grocyProductId: grocyProductId ?? existing.grocyProductId, updatedAt: now })
      .where(eq(checkLifecycles.id, existing.id))
      .run();
    return { ...existing, status: 'processing', grocyProductId: grocyProductId ?? existing.grocyProductId };
  }
  const demand = db.select().from(demands).where(eq(demands.mealieItemId, item.id)).get();
  const row: CheckLifecycleRow = {
    id: randomUUID(),
    mealieItemId: item.id,
    demandRevisionId: demand?.latestRevisionId ?? null,
    mealieFoodId: item.foodId ?? null,
    grocyProductId,
    quantity: item.quantity ?? null,
    status: 'processing',
    checkedObservedAt: now,
    closedReason: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(checkLifecycles).values(row).run();
  return row;
}

const UNSETTLED_REDUCTION_STATUSES = ['planned', 'in_flight', 'unknown', 'not_applied'];

/**
 * Refuse to book a manual check for a row that a receipt or substitution is
 * already fulfilling, while that fulfilment's list update is unsettled or was
 * superseded by this very check. The match is by the exact Mealie row of the
 * planned reduction, never by product or time window. Skipped once the user
 * resolved the review with "book the check anyway".
 */
export function guardReceiptFulfillment(lifecycleId: string, mealieItemId: string, now = new Date()): void {
  const decided = db.select().from(discrepancies)
    .where(and(eq(discrepancies.lifecycleId, lifecycleId), eq(discrepancies.kind, 'check_after_receipt')))
    .all();
  if (decided.some(row => row.status === 'resolved' && row.resolution === 'book_check')) return;
  const conflicting = listEffects<{ itemId?: string }>({ kinds: ['mealie_reduce'] }).filter((effect) => {
    if (effect.payload.itemId !== mealieItemId) return false;
    if (effect.sourceKind !== 'receipt' && effect.sourceKind !== 'substitution') return false;
    if (UNSETTLED_REDUCTION_STATUSES.includes(effect.status)) return true;
    // The reduction lost the race against this check: the purchase is already in Grocy.
    return effect.status === 'superseded' && effect.evidence?.observedChecked === true;
  });
  if (conflicting.length === 0) return;
  db.insert(discrepancies).values({
    id: randomUUID(),
    kind: 'check_after_receipt',
    status: 'open',
    receiptLineId: null,
    lifecycleId,
    evidenceJson: JSON.stringify({
      mealieItemId,
      effects: conflicting.map(effect => ({ id: effect.id, status: effect.status, sourceKind: effect.sourceKind, receiptId: effect.sourceRef, payload: effect.payload })),
    }),
    createdAt: now,
  }).onConflictDoNothing().run();
  throw new CheckDeferredError(lifecycleId, conflicting.map(effect => effect.id));
}

export function setLifecycleStatus(lifecycleId: string, status: CheckLifecycleStatus, now = new Date()): void {
  db.update(checkLifecycles).set({ status, updatedAt: now }).where(eq(checkLifecycles.id, lifecycleId)).run();
}

export function checkEffectKey(lifecycleId: string, grocyProductId: number): string {
  return `check:${lifecycleId}:grocy_add:${grocyProductId}`;
}

export type CheckBookingResult = 'applied' | 'already_applied';

/**
 * Book stock for a checked row through the ledger.
 * Throws the original error when the write definitely failed (safe to retry),
 * and `UncertainWriteError` when the outcome is unknown (never retried).
 */
export async function bookCheckStock(
  lifecycle: Pick<CheckLifecycleRow, 'id'>,
  productId: number,
  amount: number,
  label: string,
  deps: Partial<EffectRunnerDeps> = {},
): Promise<CheckBookingResult> {
  const runnerDeps: EffectRunnerDeps = { ...defaultEffectRunnerDeps, ...deps };
  const effect = ensureEffect<GrocyAddPayload>({
    effectKey: checkEffectKey(lifecycle.id, productId),
    kind: 'grocy_add',
    sourceKind: 'check',
    sourceRef: lifecycle.id,
    payload: { productId, amount, label },
  });
  if (effect.status === 'applied') return 'already_applied';
  if (effect.status === 'unknown' || effect.status === 'in_flight') {
    throw new UncertainWriteError(effect.id, `Earlier booking of "${label}" has an unknown outcome and needs review.`, productId);
  }
  if (effect.status === 'cancelled' || effect.status === 'superseded') return 'already_applied';

  let failure: unknown = null;
  const capturingDeps: EffectRunnerDeps = {
    ...runnerDeps,
    addStock: async (...args: Parameters<typeof addProductStock>): Promise<StockLogEntry[]> => {
      try {
        return await runnerDeps.addStock(...args);
      } catch (error) {
        failure = error;
        throw error;
      }
    },
  };
  const status = await runGrocyAddEffect(effect, capturingDeps);
  if (status === 'applied') return 'applied';
  if (status === 'not_applied') throw failure ?? new Error(`Booking "${label}" failed`);
  throw new UncertainWriteError(effect.id, `Booking "${label}" in Grocy has an unknown outcome; it will not be retried automatically.`, productId);
}

export interface LifecycleReconcileResult {
  verifiedApplied: number;
  stillUnknown: number;
  retryRequested: string[];
  closed: number;
  /** Grocy products whose uncertain check booking was verified as applied in this run. */
  appliedProductIds: number[];
  /** Rows whose lifecycle completed in this run (all bookings settled). */
  completedItemIds: string[];
}

/**
 * Verify uncertain check bookings, move resolved lifecycles forward and close
 * lifecycles of rows that left the list. Runs under the sync lock.
 */
export async function reconcileCheckLifecycles(
  currentItemIds: Set<string> | null,
  deps: Partial<EffectRunnerDeps> = {},
  now = new Date(),
): Promise<LifecycleReconcileResult> {
  const runnerDeps: EffectRunnerDeps = { ...defaultEffectRunnerDeps, ...deps };
  const result: LifecycleReconcileResult = {
    verifiedApplied: 0, stillUnknown: 0, retryRequested: [], closed: 0, appliedProductIds: [], completedItemIds: [],
  };
  recoverInterruptedEffects(now);

  const open = db.select().from(checkLifecycles).where(inArray(checkLifecycles.status, ['blocked', 'failed', 'processing'])).all();
  if (open.length > 0) {
    const effects = listEffects<GrocyAddPayload>({ sourceKind: 'check', kinds: ['grocy_add'], statuses: ['unknown'], sourceRefs: open.map(lifecycle => lifecycle.id) });
    for (const effect of effects) {
      const verification = await verifyGrocyAddEffect(effect, runnerDeps);
      if (verification === 'applied') {
        result.verifiedApplied++;
        // The caller sets the manual-check low-stock guard for this product, as for a direct booking.
        result.appliedProductIds.push(effect.payload.productId);
      } else {
        result.stillUnknown++;
      }
    }
    for (const lifecycle of open.filter(candidate => candidate.status === 'blocked')) {
      const awaitingReview = db.select().from(discrepancies)
        .where(and(eq(discrepancies.lifecycleId, lifecycle.id), eq(discrepancies.kind, 'check_after_receipt'), eq(discrepancies.status, 'open')))
        .get();
      if (awaitingReview) continue;
      const statuses = listEffects({ sourceKind: 'check', sourceRefs: [lifecycle.id] }).map(effect => effect.status);
      if (statuses.includes('unknown') || statuses.includes('in_flight')) continue;
      if (statuses.some(status => status === 'not_applied' || status === 'planned')) {
        // The user decided the booking did not happen: process the row again.
        setLifecycleStatus(lifecycle.id, 'retry', now);
        result.retryRequested.push(lifecycle.mealieItemId);
      } else {
        setLifecycleStatus(lifecycle.id, 'completed', now);
        result.completedItemIds.push(lifecycle.mealieItemId);
      }
    }
  }

  const retry = db.select().from(checkLifecycles).where(eq(checkLifecycles.status, 'retry')).all();
  for (const lifecycle of retry) {
    if (!result.retryRequested.includes(lifecycle.mealieItemId)) result.retryRequested.push(lifecycle.mealieItemId);
  }

  if (currentItemIds) {
    const unclosed = db.select().from(checkLifecycles).where(isNull(checkLifecycles.closedAt)).all();
    for (const lifecycle of unclosed) {
      if (currentItemIds.has(lifecycle.mealieItemId)) continue;
      // Removal by cleanup or the user closes the lifecycle but keeps it for attribution.
      db.update(checkLifecycles)
        .set({ closedAt: now, closedReason: 'removed', updatedAt: now })
        .where(eq(checkLifecycles.id, lifecycle.id))
        .run();
      result.closed++;
    }
  }
  return result;
}

/** The row was unchecked: cancel lifecycles that booked nothing; keep the rest for attribution. */
export function handleUncheckedItem(mealieItemId: string, now = new Date()): void {
  const open = findOpenLifecycle(mealieItemId);
  if (!open) return;
  const effects = listEffects({ sourceKind: 'check', sourceRefs: [open.id] });
  const touched = effects.some(effect => ['applied', 'unknown', 'in_flight'].includes(effect.status));
  if (touched) {
    if (open.status !== 'blocked') {
      db.update(checkLifecycles).set({ status: 'completed', closedReason: 'unchecked', closedAt: now, updatedAt: now })
        .where(eq(checkLifecycles.id, open.id)).run();
    }
    return;
  }
  for (const effect of effects) {
    // Nothing was written; drop the pending booking together with the lifecycle.
    completeEffect(effect.id, { status: 'cancelled', fromStatuses: ['planned', 'not_applied'] }, undefined, now);
  }
  db.update(checkLifecycles).set({ status: 'cancelled', closedReason: 'unchecked', closedAt: now, updatedAt: now })
    .where(eq(checkLifecycles.id, open.id)).run();
}

export interface LifecycleBooking {
  effectId: string;
  productId: number;
  amount: number;
  status: string;
  transactionId: string | null;
}

export function getLifecycleBookings(lifecycleId: string): LifecycleBooking[] {
  return listEffects<GrocyAddPayload>({ sourceKind: 'check', kinds: ['grocy_add'], sourceRefs: [lifecycleId] })
    .map((effect) => {
      return {
        effectId: effect.id,
        productId: effect.payload.productId,
        amount: effect.payload.amount,
        status: effect.status,
        transactionId: effect.externalRef,
      };
    });
}

export function getLifecycle(id: string): CheckLifecycleRow | null {
  return db.select().from(checkLifecycles).where(eq(checkLifecycles.id, id)).get() ?? null;
}

export { getEffect };
