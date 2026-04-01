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
  });

  await db.insert(syncState)
    .values({ id: STATE_ID, stateData })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { stateData },
    });
}
