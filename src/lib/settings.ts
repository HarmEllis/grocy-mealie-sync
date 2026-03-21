import { db } from './db';
import { syncState } from './db/schema';
import { eq } from 'drizzle-orm';

export interface AppSettings {
  defaultUnitMappingId: string | null;
}

const SETTINGS_ID = 'settings';

export async function getSettings(): Promise<AppSettings> {
  const records = await db.select().from(syncState).where(eq(syncState.id, SETTINGS_ID)).limit(1);
  if (records.length === 0) {
    return { defaultUnitMappingId: null };
  }
  const data = JSON.parse(records[0].stateData);
  return {
    defaultUnitMappingId: data.defaultUnitMappingId || null,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const stateData = JSON.stringify(settings);
  const records = await db.select().from(syncState).where(eq(syncState.id, SETTINGS_ID)).limit(1);
  if (records.length === 0) {
    await db.insert(syncState).values({ id: SETTINGS_ID, stateData });
  } else {
    await db.update(syncState).set({ stateData }).where(eq(syncState.id, SETTINGS_ID));
  }
}
