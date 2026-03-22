import { db } from '../db';
import { syncState } from '../db/schema';
import { eq } from 'drizzle-orm';
import { log } from '../logger';

export interface SyncStateData {
  lastGrocyPoll: Date | null;
  lastMealiePoll: Date | null;
  grocyBelowMinStock: Record<number, number>;
  mealieCheckedItems: Record<string, boolean>;
  /** Products recently restocked by Mealie→Grocy sync (grocyProductId as string → ISO timestamp).
   *  Used to prevent the Grocy→Mealie sync from removing items that were
   *  restocked automatically rather than manually by the user.
   *  Keys are strings because JSON serialization converts number keys to strings. */
  syncRestockedProducts: Record<string, string>;
}

const STATE_ID = 'singleton';

const DEFAULT_STATE: SyncStateData = {
  lastGrocyPoll: null,
  lastMealiePoll: null,
  grocyBelowMinStock: {},
  mealieCheckedItems: {},
  syncRestockedProducts: {},
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
    syncRestockedProducts: (state.syncRestockedProducts as Record<string, string>) || {},
  };
}

export async function saveSyncState(state: SyncStateData) {
  const stateData = JSON.stringify({
    lastGrocyPoll: state.lastGrocyPoll?.toISOString() || null,
    lastMealiePoll: state.lastMealiePoll?.toISOString() || null,
    grocyBelowMinStock: state.grocyBelowMinStock,
    mealieCheckedItems: state.mealieCheckedItems,
    syncRestockedProducts: state.syncRestockedProducts,
  });

  await db.insert(syncState)
    .values({ id: STATE_ID, stateData })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { stateData },
    });
}
