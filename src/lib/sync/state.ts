import { db } from '../db';
import { syncState } from '../db/schema';
import { eq } from 'drizzle-orm';

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

export async function getSyncState(): Promise<SyncStateData> {
  const records = await db.select().from(syncState).where(eq(syncState.id, STATE_ID)).limit(1);
  if (records.length === 0) {
    return {
      lastGrocyPoll: null,
      lastMealiePoll: null,
      grocyBelowMinStock: {},
      mealieCheckedItems: {},
      syncRestockedProducts: {},
    };
  }
  
  const state = JSON.parse(records[0].stateData);
  return {
    lastGrocyPoll: state.lastGrocyPoll ? new Date(state.lastGrocyPoll) : null,
    lastMealiePoll: state.lastMealiePoll ? new Date(state.lastMealiePoll) : null,
    grocyBelowMinStock: state.grocyBelowMinStock || {},
    mealieCheckedItems: state.mealieCheckedItems || {},
    syncRestockedProducts: state.syncRestockedProducts || {},
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

  const records = await db.select().from(syncState).where(eq(syncState.id, STATE_ID)).limit(1);
  if (records.length === 0) {
    await db.insert(syncState).values({
      id: STATE_ID,
      stateData
    });
  } else {
    await db.update(syncState)
      .set({ stateData })
      .where(eq(syncState.id, STATE_ID));
  }
}
