import { eq } from 'drizzle-orm';
import { syncState } from '../db/schema';
import type { LedgerTx, ShopEffect } from './ledger';
import { recordAccountedRestock } from './low-stock-accounting';
import type { GrocyAddPayload } from './effect-runners';

export interface GrocyAddHookOptions {
  /**
   * Manual-check bookings protect the low-stock sync through the
   * `syncRestockedProducts` guard. Inside a poll the caller sets it on its
   * in-memory state; outside a poll (user resolution under the sync lock) it
   * is written to the stored state in the same transaction.
   */
  writeCheckGuardToState: boolean;
  now?: Date;
}

/**
 * Bookkeeping that must happen exactly once, atomically with marking a Grocy
 * booking applied, whether it was applied directly, verified later, or
 * resolved by the user.
 */
export function applyGrocyAddSideEffects(tx: LedgerTx, effect: ShopEffect<GrocyAddPayload>, options: GrocyAddHookOptions): void {
  const now = options.now ?? new Date();
  if (effect.sourceKind === 'receipt' || effect.sourceKind === 'substitution') {
    recordAccountedRestock(tx, effect.id, effect.payload.productId, effect.payload.amount, now);
    return;
  }
  if (effect.sourceKind === 'check' && options.writeCheckGuardToState) {
    const row = tx.select().from(syncState).where(eq(syncState.id, 'singleton')).get();
    if (!row) return;
    let state: Record<string, unknown>;
    try {
      state = JSON.parse(row.stateData) as Record<string, unknown>;
    } catch {
      return;
    }
    const guard = { ...((state.syncRestockedProducts as Record<string, string> | undefined) ?? {}) };
    guard[String(effect.payload.productId)] = now.toISOString();
    state.syncRestockedProducts = guard;
    tx.update(syncState).set({ stateData: JSON.stringify(state) }).where(eq(syncState.id, 'singleton')).run();
  }
}
