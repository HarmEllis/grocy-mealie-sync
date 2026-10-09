import { eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import { lowStockAccountedRestocks, shopEffects } from '../db/schema';
import type { LedgerTx } from './ledger';

/**
 * Coordination between ledger bookings and the Grocy -> Mealie low-stock
 * sync, so one purchase never reduces the Mealie list twice:
 *
 * - A receipt booking that is applied records its stock amount here, in the
 *   same transaction that marks the effect applied. The next low-stock poll
 *   subtracts it from the previous shortage (for all three paths: newly
 *   missing, changed, no longer missing) and marks it consumed atomically with
 *   the new low-stock snapshot.
 * - While any Grocy booking is in flight or unknown, its product is frozen:
 *   the low-stock poll neither adjusts the list for it nor moves its snapshot,
 *   so the eventual outcome is accounted for exactly once.
 */

export interface AccountedRestock {
  effectId: string;
  grocyProductId: number;
  stockAmount: number;
}

export function recordAccountedRestock(tx: LedgerTx, effectId: string, grocyProductId: number, stockAmount: number, now = new Date()): void {
  tx.insert(lowStockAccountedRestocks)
    .values({ effectId, grocyProductId, stockAmount, createdAt: now })
    .onConflictDoNothing()
    .run();
}

export interface LowStockAdjustments {
  accounted: AccountedRestock[];
  /** Grocy products with a booking whose outcome is not known yet. */
  frozenProductIds: Set<number>;
}

export function loadLowStockAdjustments(): LowStockAdjustments {
  const accounted = db.select().from(lowStockAccountedRestocks).where(isNull(lowStockAccountedRestocks.consumedAt)).all()
    .map(row => ({ effectId: row.effectId, grocyProductId: row.grocyProductId, stockAmount: row.stockAmount }));
  const frozenProductIds = new Set<number>();
  const pending = db.select().from(shopEffects).where(inArray(shopEffects.status, ['in_flight', 'unknown'])).all();
  for (const effect of pending) {
    if (effect.kind !== 'grocy_add' && effect.kind !== 'grocy_consume') continue;
    try {
      const productId = Number((JSON.parse(effect.payloadJson) as { productId?: unknown }).productId);
      if (Number.isFinite(productId)) frozenProductIds.add(productId);
    } catch {
      // Ignore malformed payloads; they cannot be executed either.
    }
  }
  return { accounted, frozenProductIds };
}

export function consumeAccountedRestocks(tx: LedgerTx, effectIds: string[], now = new Date()): void {
  if (effectIds.length === 0) return;
  tx.update(lowStockAccountedRestocks).set({ consumedAt: now }).where(inArray(lowStockAccountedRestocks.effectId, effectIds)).run();
}

export function isAccountedRestockRecorded(effectId: string): boolean {
  return Boolean(db.select().from(lowStockAccountedRestocks).where(eq(lowStockAccountedRestocks.effectId, effectId)).get());
}
