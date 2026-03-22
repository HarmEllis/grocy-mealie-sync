import { db } from './db';
import { syncState } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import { log } from './logger';

export interface AppSettings {
  defaultUnitMappingId: string | null;
  mealieShoppingListId: string | null;
  autoCreateProducts: boolean;
  autoCreateUnits: boolean;
}

const SETTINGS_ID = 'settings';

const DEFAULT_SETTINGS: AppSettings = {
  defaultUnitMappingId: null,
  mealieShoppingListId: null,
  autoCreateProducts: false,
  autoCreateUnits: false,
};

export async function getSettings(): Promise<AppSettings> {
  const records = await db.select().from(syncState).where(eq(syncState.id, SETTINGS_ID)).limit(1);
  if (records.length === 0) {
    return { ...DEFAULT_SETTINGS };
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(records[0].stateData);
  } catch (e) {
    log.error('Failed to parse settings JSON, returning defaults:', e);
    return { ...DEFAULT_SETTINGS };
  }
  return {
    defaultUnitMappingId: (data.defaultUnitMappingId as string) || null,
    mealieShoppingListId: (data.mealieShoppingListId as string) || null,
    autoCreateProducts: (data.autoCreateProducts as boolean) ?? false,
    autoCreateUnits: (data.autoCreateUnits as boolean) ?? false,
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
  await db.insert(syncState)
    .values({ id: SETTINGS_ID, stateData })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { stateData },
    });
}
