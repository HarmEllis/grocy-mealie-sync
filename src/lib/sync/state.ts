import { db } from '../db';
import { syncState } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface SyncStateData {
  lastGrocyPoll: Date | null;
  lastMealiePoll: Date | null;
  grocyBelowMinStock: number[];
  mealieCheckedItems: Record<string, boolean>;
}

const STATE_ID = 'singleton';

export async function getSyncState(): Promise<SyncStateData> {
  const records = await db.select().from(syncState).where(eq(syncState.id, STATE_ID)).limit(1);
  if (records.length === 0) {
    return {
      lastGrocyPoll: null,
      lastMealiePoll: null,
      grocyBelowMinStock: [],
      mealieCheckedItems: {},
    };
  }
  
  const state = JSON.parse(records[0].stateData);
  return {
    lastGrocyPoll: state.lastGrocyPoll ? new Date(state.lastGrocyPoll) : null,
    lastMealiePoll: state.lastMealiePoll ? new Date(state.lastMealiePoll) : null,
    grocyBelowMinStock: state.grocyBelowMinStock || [],
    mealieCheckedItems: state.mealieCheckedItems || {},
  };
}

export async function saveSyncState(state: SyncStateData) {
  const stateData = JSON.stringify({
    lastGrocyPoll: state.lastGrocyPoll?.toISOString() || null,
    lastMealiePoll: state.lastMealiePoll?.toISOString() || null,
    grocyBelowMinStock: state.grocyBelowMinStock,
    mealieCheckedItems: state.mealieCheckedItems,
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
