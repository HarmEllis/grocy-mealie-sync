import { db } from './db';
import { syncState } from './db/schema';
import { eq } from 'drizzle-orm';

export interface AppSettings {
  defaultUnitMappingId: string | null;
  mealieShoppingListId: string | null;
}

const SETTINGS_ID = 'settings';

export async function getSettings(): Promise<AppSettings> {
  const records = await db.select().from(syncState).where(eq(syncState.id, SETTINGS_ID)).limit(1);
  if (records.length === 0) {
    return { defaultUnitMappingId: null, mealieShoppingListId: null };
  }
  const data = JSON.parse(records[0].stateData);
  return {
    defaultUnitMappingId: data.defaultUnitMappingId || null,
    mealieShoppingListId: data.mealieShoppingListId || null,
  };
}

/** Resolve Mealie shopping list ID. Priority: 1. DB setting (from UI), 2. env var. */
export async function resolveShoppingListId(): Promise<string | null> {
  const settings = await getSettings();
  if (settings.mealieShoppingListId) return settings.mealieShoppingListId;
  const { config } = await import('./config');
  if (config.mealieShoppingListId) return config.mealieShoppingListId;
  return null;
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
