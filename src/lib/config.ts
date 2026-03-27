import dotenv from 'dotenv';
import { log } from './logger';
import { normalizeMinStockStep, type MinStockStep } from './min-stock-step';
dotenv.config();

const GROCY_DEFAULT_URL = 'http://grocy:9283';
const MEALIE_DEFAULT_URL = 'http://mealie:9925';

/**
 * Validates that a URL starts with http:// or https:// and is non-empty.
 * Returns the validated URL or the fallback default.
 */
export function validateServiceUrl(value: string | undefined, name: string, defaultUrl: string): string {
  if (!value || value.trim() === '') {
    return defaultUrl;
  }
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    log.warn(
      `[Config] ${name} must start with http:// or https:// (got "${trimmed}"). Falling back to default: ${defaultUrl}`,
    );
    return defaultUrl;
  }
  return trimmed;
}

export function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  const parsed = parseInt(value || '', 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function hasConfiguredValue(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== '';
}

export function parseOptionalIntEnv(value: string | undefined, name: string): number | null {
  if (!hasConfiguredValue(value)) {
    return null;
  }

  const parsed = parseInt(value!.trim(), 10);
  if (isNaN(parsed)) {
    log.warn(`[Config] ${name} must be an integer (got "${value}"). Ignoring the env var.`);
    return null;
  }

  return parsed;
}

export function parseBooleanEnv(value: string | undefined, defaultValue: boolean, name: string): boolean {
  if (!hasConfiguredValue(value)) {
    return defaultValue;
  }

  switch (value!.trim().toLowerCase()) {
    case 'true':
    case '1':
      return true;
    case 'false':
    case '0':
      return false;
    default:
      log.warn(`[Config] ${name} must be true/false/1/0 (got "${value}"). Falling back to ${defaultValue}.`);
      return defaultValue;
  }
}

export function parseMinStockStepEnv(
  value: string | undefined,
  defaultValue: MinStockStep,
  name: string,
): MinStockStep {
  if (!hasConfiguredValue(value)) {
    return defaultValue;
  }

  const trimmed = value!.trim();
  const normalized = normalizeMinStockStep(trimmed, defaultValue);

  if (normalized !== trimmed) {
    log.warn(
      `[Config] ${name} must be one of ${['1', '0.1', '0.01'].join(', ')} (got "${value}"). Falling back to ${defaultValue}.`,
    );
  }

  return normalized;
}

export const config = {
  grocyUrl: validateServiceUrl(process.env.GROCY_URL, 'GROCY_URL', GROCY_DEFAULT_URL),
  grocyApiKey: process.env.GROCY_API_KEY || '',
  mealieUrl: validateServiceUrl(process.env.MEALIE_URL, 'MEALIE_URL', MEALIE_DEFAULT_URL),
  mealieApiToken: process.env.MEALIE_API_TOKEN || '',
  mealieShoppingListId: process.env.MEALIE_SHOPPING_LIST_ID || '',
  pollIntervalSeconds: parseIntOrDefault(process.env.POLL_INTERVAL_SECONDS, 60),
  productSyncIntervalHours: parseIntOrDefault(process.env.PRODUCT_SYNC_INTERVAL_HOURS, 6),
  grocyDefaultUnitId: parseOptionalIntEnv(process.env.GROCY_DEFAULT_UNIT_ID, 'GROCY_DEFAULT_UNIT_ID'),
  autoCreateProducts: parseBooleanEnv(process.env.AUTO_CREATE_PRODUCTS, false, 'AUTO_CREATE_PRODUCTS'),
  autoCreateUnits: parseBooleanEnv(process.env.AUTO_CREATE_UNITS, false, 'AUTO_CREATE_UNITS'),
  ensureLowStockOnMealieList: parseBooleanEnv(
    process.env.ENSURE_LOW_STOCK_ON_MEALIE_LIST,
    false,
    'ENSURE_LOW_STOCK_ON_MEALIE_LIST',
  ),
  syncMealieInPossession: parseBooleanEnv(
    process.env.SYNC_MEALIE_IN_POSSESSION,
    false,
    'SYNC_MEALIE_IN_POSSESSION',
  ),
  mealieInPossessionOnlyAboveMinStock: parseBooleanEnv(
    process.env.MEALIE_IN_POSSESSION_ONLY_ABOVE_MIN_STOCK,
    false,
    'MEALIE_IN_POSSESSION_ONLY_ABOVE_MIN_STOCK',
  ),
  mappingWizardMinStockStep: parseMinStockStepEnv(
    process.env.MAPPING_WIZARD_MIN_STOCK_STEP,
    '1',
    'MAPPING_WIZARD_MIN_STOCK_STEP',
  ),
  stockOnlyMinStock: parseBooleanEnv(process.env.STOCK_ONLY_MIN_STOCK, false, 'STOCK_ONLY_MIN_STOCK'),
  databasePath: process.env.DATABASE_PATH || './data/sync.db',
  envOverrides: {
    mealieShoppingListId: hasConfiguredValue(process.env.MEALIE_SHOPPING_LIST_ID),
    grocyDefaultUnitId: hasConfiguredValue(process.env.GROCY_DEFAULT_UNIT_ID),
    autoCreateProducts: hasConfiguredValue(process.env.AUTO_CREATE_PRODUCTS),
    autoCreateUnits: hasConfiguredValue(process.env.AUTO_CREATE_UNITS),
    ensureLowStockOnMealieList: hasConfiguredValue(process.env.ENSURE_LOW_STOCK_ON_MEALIE_LIST),
    syncMealieInPossession: hasConfiguredValue(process.env.SYNC_MEALIE_IN_POSSESSION),
    mealieInPossessionOnlyAboveMinStock: hasConfiguredValue(process.env.MEALIE_IN_POSSESSION_ONLY_ABOVE_MIN_STOCK),
    mappingWizardMinStockStep: hasConfiguredValue(process.env.MAPPING_WIZARD_MIN_STOCK_STEP),
    stockOnlyMinStock: hasConfiguredValue(process.env.STOCK_ONLY_MIN_STOCK),
  },
  envRaw: {
    mealieShoppingListId: process.env.MEALIE_SHOPPING_LIST_ID?.trim() || null,
    grocyDefaultUnitId: process.env.GROCY_DEFAULT_UNIT_ID?.trim() || null,
    autoCreateProducts: process.env.AUTO_CREATE_PRODUCTS?.trim() || null,
    autoCreateUnits: process.env.AUTO_CREATE_UNITS?.trim() || null,
    ensureLowStockOnMealieList: process.env.ENSURE_LOW_STOCK_ON_MEALIE_LIST?.trim() || null,
    syncMealieInPossession: process.env.SYNC_MEALIE_IN_POSSESSION?.trim() || null,
    mealieInPossessionOnlyAboveMinStock: process.env.MEALIE_IN_POSSESSION_ONLY_ABOVE_MIN_STOCK?.trim() || null,
    mappingWizardMinStockStep: process.env.MAPPING_WIZARD_MIN_STOCK_STEP?.trim() || null,
    stockOnlyMinStock: process.env.STOCK_ONLY_MIN_STOCK?.trim() || null,
  },
};
