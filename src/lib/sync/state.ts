import { db } from '../db';
import { syncState } from '../db/schema';
import { eq } from 'drizzle-orm';
import { log } from '../logger';

export interface SyncStateData {
  lastGrocyPoll: Date | null;
  lastMealiePoll: Date | null;
  grocyBelowMinStock: Record<number, number>;
  mealieCheckedItems: Record<string, boolean>;
  mealieInPossessionByGrocyProduct: Record<string, boolean>;
  /** Products recently restocked by Mealie→Grocy sync (grocyProductId as string → ISO timestamp).
   *  Used to prevent the Grocy→Mealie sync from removing items that were
   *  restocked automatically rather than manually by the user.
   *  Keys are strings because JSON serialization converts number keys to strings. */
  syncRestockedProducts: Record<string, string>;
  /** Timestamp when each Mealie item was first detected as checked (itemId → ISO timestamp).
   *  Used by the cleanup scheduler to know how long an item has been checked. */
  mealieCheckedAt: Record<string, string>;
  /** Mealie items that were successfully synced to Grocy (itemId → ISO timestamp).
   *  Used by the cleanup scheduler in 'synced_only' mode. */
  mealieItemsSyncedToGrocy: Record<string, string>;
  /** ISO timestamp of the last cleanup run. Used to prevent re-running within the same day. */
  lastCleanupRun: string | null;
  /** Snapshot of child product ID → parent product ID from the previous poll.
   *  Used to build effectivePreviousMap without misattributing amounts when a product is re-parented. */
  grocyEffectiveParentByOriginalId: Record<number, number>;
  /** Per-item sub-product restock progress for idempotent retry.
   *  Maps Mealie itemId → list of Grocy product IDs already successfully restocked.
   *  Cleared when all sub-items for an item succeed or when the item becomes unchecked. */
  mealieSubRestockProgress: Record<string, number[]>;
  /** Own-stock deficit for parent products from the last poll (productId → deficit).
   *  Tracks deficits detected by SYNC_PARENT_OWN_STOCK, separate from Grocy's
   *  aggregate-based missing_products report. */
  grocyParentOwnStockDeficit: Record<number, number>;
  /** Effective missing amounts that were skipped (not removed from Mealie) in the previous poll
   *  because the product was restocked by sync (syncRestockedProducts guard).
   *  Incorporated into effectivePreviousMap at the start of the next poll so that
   *  quantity adjustments remain accurate. Keyed by effectiveId; reset each poll. */
  grocySkippedRestockAmounts: Record<number, number>;
}

const STATE_ID = 'singleton';

const DEFAULT_STATE: SyncStateData = {
  lastGrocyPoll: null,
  lastMealiePoll: null,
  grocyBelowMinStock: {},
  mealieCheckedItems: {},
  mealieInPossessionByGrocyProduct: {},
  syncRestockedProducts: {},
  mealieCheckedAt: {},
  mealieItemsSyncedToGrocy: {},
  lastCleanupRun: null,
  grocyEffectiveParentByOriginalId: {},
  mealieSubRestockProgress: {},
  grocyParentOwnStockDeficit: {},
  grocySkippedRestockAmounts: {},
};

export async function getSyncState(): Promise<SyncStateData> {
  const records = await db.select().from(syncState).where(eq(syncState.id, STATE_ID)).limit(1);
  if (records.length === 0) {
    return { ...DEFAULT_STATE };
  }

  let state: Record<string, unknown>;
  try {
    state = JSON.parse(records[0].stateData);
  } catch (e) {
    log.error('Failed to parse sync state JSON, returning defaults:', e);
    return { ...DEFAULT_STATE };
  }

  return {
    lastGrocyPoll: state.lastGrocyPoll ? new Date(state.lastGrocyPoll as string) : null,
    lastMealiePoll: state.lastMealiePoll ? new Date(state.lastMealiePoll as string) : null,
    grocyBelowMinStock: (state.grocyBelowMinStock as Record<number, number>) || {},
    mealieCheckedItems: (state.mealieCheckedItems as Record<string, boolean>) || {},
    mealieInPossessionByGrocyProduct: (state.mealieInPossessionByGrocyProduct as Record<string, boolean>) || {},
    syncRestockedProducts: (state.syncRestockedProducts as Record<string, string>) || {},
    mealieCheckedAt: (state.mealieCheckedAt as Record<string, string>) || {},
    mealieItemsSyncedToGrocy: (state.mealieItemsSyncedToGrocy as Record<string, string>) || {},
    lastCleanupRun: (state.lastCleanupRun as string) || null,
    grocyEffectiveParentByOriginalId: (state.grocyEffectiveParentByOriginalId as Record<number, number>) || {},
    mealieSubRestockProgress: (state.mealieSubRestockProgress as Record<string, number[]>) || {},
    grocyParentOwnStockDeficit: (state.grocyParentOwnStockDeficit as Record<number, number>) || {},
    grocySkippedRestockAmounts: (state.grocySkippedRestockAmounts as Record<number, number>) || {},
  };
}

export async function saveSyncState(state: SyncStateData) {
  const stateData = JSON.stringify({
    lastGrocyPoll: state.lastGrocyPoll?.toISOString() || null,
    lastMealiePoll: state.lastMealiePoll?.toISOString() || null,
    grocyBelowMinStock: state.grocyBelowMinStock,
    mealieCheckedItems: state.mealieCheckedItems,
    mealieInPossessionByGrocyProduct: state.mealieInPossessionByGrocyProduct,
    syncRestockedProducts: state.syncRestockedProducts,
    mealieCheckedAt: state.mealieCheckedAt,
    mealieItemsSyncedToGrocy: state.mealieItemsSyncedToGrocy,
    lastCleanupRun: state.lastCleanupRun,
    grocyEffectiveParentByOriginalId: state.grocyEffectiveParentByOriginalId,
    mealieSubRestockProgress: state.mealieSubRestockProgress,
    grocyParentOwnStockDeficit: state.grocyParentOwnStockDeficit,
    grocySkippedRestockAmounts: state.grocySkippedRestockAmounts,
  });

  await db.insert(syncState)
    .values({ id: STATE_ID, stateData })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { stateData },
    });
}
