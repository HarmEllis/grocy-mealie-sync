import { db } from './db';
import { syncState } from './db/schema';
import { eq } from 'drizzle-orm';
import { log } from './logger';
import { config } from './config';
import { normalizeMinStockStep, type MinStockStep } from './min-stock-step';

export interface AppSettings {
  defaultUnitMappingId: string | null;
  mealieShoppingListId: string | null;
  autoCreateProducts: boolean;
  autoCreateUnits: boolean;
  ensureLowStockOnMealieList: boolean;
  syncMealieInPossession: boolean;
  mealieInPossessionOnlyAboveMinStock: boolean;
  mappingWizardMinStockStep: MinStockStep;
  stockOnlyMinStock: boolean;
}

export interface SettingsLocks {
  defaultUnitMappingId: SettingLock;
  mealieShoppingListId: SettingLock;
  autoCreateProducts: SettingLock;
  autoCreateUnits: SettingLock;
  ensureLowStockOnMealieList: SettingLock;
  syncMealieInPossession: SettingLock;
  mealieInPossessionOnlyAboveMinStock: SettingLock;
  mappingWizardMinStockStep: SettingLock;
  stockOnlyMinStock: SettingLock;
}

export interface SettingLock {
  locked: boolean;
  envVar: string;
  envValue: string | null;
}

type SettingKey = keyof AppSettings;

const SETTING_ENV_VARS: Record<SettingKey, string> = {
  defaultUnitMappingId: 'GROCY_DEFAULT_UNIT_ID',
  mealieShoppingListId: 'MEALIE_SHOPPING_LIST_ID',
  autoCreateProducts: 'AUTO_CREATE_PRODUCTS',
  autoCreateUnits: 'AUTO_CREATE_UNITS',
  ensureLowStockOnMealieList: 'ENSURE_LOW_STOCK_ON_MEALIE_LIST',
  syncMealieInPossession: 'SYNC_MEALIE_IN_POSSESSION',
  mealieInPossessionOnlyAboveMinStock: 'MEALIE_IN_POSSESSION_ONLY_ABOVE_MIN_STOCK',
  mappingWizardMinStockStep: 'MAPPING_WIZARD_MIN_STOCK_STEP',
  stockOnlyMinStock: 'STOCK_ONLY_MIN_STOCK',
};

const SETTINGS_ID = 'settings';

const DEFAULT_SETTINGS: AppSettings = {
  defaultUnitMappingId: null,
  mealieShoppingListId: null,
  autoCreateProducts: false,
  autoCreateUnits: false,
  ensureLowStockOnMealieList: false,
  syncMealieInPossession: false,
  mealieInPossessionOnlyAboveMinStock: false,
  mappingWizardMinStockStep: '1',
  stockOnlyMinStock: false,
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

  const legacyAllowDecimalMinStockInMappingWizard = typeof data.allowDecimalMinStockInMappingWizard === 'boolean'
    ? data.allowDecimalMinStockInMappingWizard
    : undefined;
  const storedMappingWizardMinStockStep = typeof data.mappingWizardMinStockStep === 'string'
    ? data.mappingWizardMinStockStep
    : null;

  return {
    defaultUnitMappingId: (data.defaultUnitMappingId as string) || null,
    mealieShoppingListId: (data.mealieShoppingListId as string) || null,
    autoCreateProducts: (data.autoCreateProducts as boolean) ?? false,
    autoCreateUnits: (data.autoCreateUnits as boolean) ?? false,
    ensureLowStockOnMealieList: (data.ensureLowStockOnMealieList as boolean) ?? false,
    syncMealieInPossession: (data.syncMealieInPossession as boolean) ?? false,
    mealieInPossessionOnlyAboveMinStock: (data.mealieInPossessionOnlyAboveMinStock as boolean) ?? false,
    mappingWizardMinStockStep: normalizeMinStockStep(
      storedMappingWizardMinStockStep
      ?? (legacyAllowDecimalMinStockInMappingWizard === undefined
        ? null
        : legacyAllowDecimalMinStockInMappingWizard
          ? '0.01'
          : '1'),
      '1',
    ),
    stockOnlyMinStock: (data.stockOnlyMinStock as boolean) ?? false,
  };
}

export function getSettingsLocks(): SettingsLocks {
  return {
    defaultUnitMappingId: {
      locked: config.envOverrides.grocyDefaultUnitId,
      envVar: SETTING_ENV_VARS.defaultUnitMappingId,
      envValue: config.envRaw.grocyDefaultUnitId,
    },
    mealieShoppingListId: {
      locked: config.envOverrides.mealieShoppingListId,
      envVar: SETTING_ENV_VARS.mealieShoppingListId,
      envValue: config.envRaw.mealieShoppingListId,
    },
    autoCreateProducts: {
      locked: config.envOverrides.autoCreateProducts,
      envVar: SETTING_ENV_VARS.autoCreateProducts,
      envValue: config.envRaw.autoCreateProducts,
    },
    autoCreateUnits: {
      locked: config.envOverrides.autoCreateUnits,
      envVar: SETTING_ENV_VARS.autoCreateUnits,
      envValue: config.envRaw.autoCreateUnits,
    },
    ensureLowStockOnMealieList: {
      locked: config.envOverrides.ensureLowStockOnMealieList,
      envVar: SETTING_ENV_VARS.ensureLowStockOnMealieList,
      envValue: config.envRaw.ensureLowStockOnMealieList,
    },
    syncMealieInPossession: {
      locked: config.envOverrides.syncMealieInPossession,
      envVar: SETTING_ENV_VARS.syncMealieInPossession,
      envValue: config.envRaw.syncMealieInPossession,
    },
    mealieInPossessionOnlyAboveMinStock: {
      locked: config.envOverrides.mealieInPossessionOnlyAboveMinStock,
      envVar: SETTING_ENV_VARS.mealieInPossessionOnlyAboveMinStock,
      envValue: config.envRaw.mealieInPossessionOnlyAboveMinStock,
    },
    mappingWizardMinStockStep: {
      locked: config.envOverrides.mappingWizardMinStockStep,
      envVar: SETTING_ENV_VARS.mappingWizardMinStockStep,
      envValue: config.envRaw.mappingWizardMinStockStep,
    },
    stockOnlyMinStock: {
      locked: config.envOverrides.stockOnlyMinStock,
      envVar: SETTING_ENV_VARS.stockOnlyMinStock,
      envValue: config.envRaw.stockOnlyMinStock,
    },
  };
}

export function isSettingLockedByEnv(key: SettingKey): boolean {
  return getSettingsLocks()[key].locked;
}

export function getSettingLockedMessage(key: SettingKey): string {
  const envVar = SETTING_ENV_VARS[key];
  return `This setting is controlled by ${envVar}. Comment out ${envVar} in your env file to edit it in the UI.`;
}

export function resolveDefaultUnitMappingId(
  storedDefaultUnitMappingId: string | null,
  allUnitMappings: { id: string; grocyUnitId: number }[],
): string | null {
  if (config.envOverrides.grocyDefaultUnitId) {
    if (config.grocyDefaultUnitId === null) {
      return null;
    }

    const match = allUnitMappings.find(u => u.grocyUnitId === config.grocyDefaultUnitId);
    return match ? match.id : null;
  }

  return storedDefaultUnitMappingId;
}

export async function resolveDefaultUnit(
  allUnitMappings: { id: string; grocyUnitId: number }[],
): Promise<{ grocyUnitId: number; unitMappingId: string | null } | null> {
  if (config.envOverrides.grocyDefaultUnitId) {
    if (config.grocyDefaultUnitId === null) {
      return null;
    }

    const match = allUnitMappings.find(u => u.grocyUnitId === config.grocyDefaultUnitId);
    return {
      grocyUnitId: config.grocyDefaultUnitId,
      unitMappingId: match ? match.id : null,
    };
  }

  const settings = await getSettings();
  if (!settings.defaultUnitMappingId) {
    return null;
  }

  const match = allUnitMappings.find(u => u.id === settings.defaultUnitMappingId);
  if (!match) {
    return null;
  }

  return { grocyUnitId: match.grocyUnitId, unitMappingId: match.id };
}

/** Resolve Mealie shopping list ID. Priority: 1. env var, 2. DB setting (from UI). */
export async function resolveShoppingListId(): Promise<string | null> {
  if (config.envOverrides.mealieShoppingListId && config.mealieShoppingListId) {
    return config.mealieShoppingListId;
  }

  const settings = await getSettings();
  if (settings.mealieShoppingListId) {
    return settings.mealieShoppingListId;
  }

  return null;
}

export async function resolveAutoCreateProducts(): Promise<boolean> {
  if (config.envOverrides.autoCreateProducts) {
    return config.autoCreateProducts;
  }

  const settings = await getSettings();
  return settings.autoCreateProducts;
}

export async function resolveAutoCreateUnits(): Promise<boolean> {
  if (config.envOverrides.autoCreateUnits) {
    return config.autoCreateUnits;
  }

  const settings = await getSettings();
  return settings.autoCreateUnits;
}

export async function resolveEnsureLowStockOnMealieList(): Promise<boolean> {
  if (config.envOverrides.ensureLowStockOnMealieList) {
    return config.ensureLowStockOnMealieList;
  }

  const settings = await getSettings();
  return settings.ensureLowStockOnMealieList;
}

export async function resolveSyncMealieInPossession(): Promise<boolean> {
  if (config.envOverrides.syncMealieInPossession) {
    return config.syncMealieInPossession;
  }

  const settings = await getSettings();
  return settings.syncMealieInPossession;
}

export async function resolveMealieInPossessionOnlyAboveMinStock(): Promise<boolean> {
  if (config.envOverrides.mealieInPossessionOnlyAboveMinStock) {
    return config.mealieInPossessionOnlyAboveMinStock;
  }

  const settings = await getSettings();
  return settings.mealieInPossessionOnlyAboveMinStock;
}

export async function resolveMappingWizardMinStockStep(): Promise<MinStockStep> {
  if (config.envOverrides.mappingWizardMinStockStep) {
    return config.mappingWizardMinStockStep;
  }

  const settings = await getSettings();
  return settings.mappingWizardMinStockStep;
}

export async function resolveStockOnlyMinStock(): Promise<boolean> {
  if (config.envOverrides.stockOnlyMinStock) {
    return config.stockOnlyMinStock;
  }

  const settings = await getSettings();
  return settings.stockOnlyMinStock;
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
