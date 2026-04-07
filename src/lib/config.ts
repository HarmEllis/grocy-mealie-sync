import dotenv from 'dotenv';
import { log } from './logger';
import { normalizeMinStockStep, type MinStockStep } from './min-stock-step';
import { resolveLocaleFromTimeZone, resolveTimeZone } from './date-time';
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

export function parseOptionalUrlEnv(value: string | undefined, name: string): string | null {
  if (!hasConfiguredValue(value)) {
    return null;
  }

  const trimmed = value!.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    log.warn(`[Config] ${name} must start with http:// or https:// (got "${value}"). Ignoring the env var.`);
    return null;
  }

  return trimmed;
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

export function parseWebhookModeEnv(
  value: string | undefined,
  name: string,
): 'always' | 'errors_only' {
  if (!hasConfiguredValue(value)) {
    return 'errors_only';
  }

  switch (value!.trim().toLowerCase()) {
    case 'always':
      return 'always';
    case 'errors_only':
      return 'errors_only';
    default:
      log.warn(`[Config] ${name} must be "always" or "errors_only" (got "${value}"). Falling back to errors_only.`);
      return 'errors_only';
  }
}

export function parseTimeZoneEnv(value: string | undefined, name: string): string | null {
  if (!hasConfiguredValue(value)) {
    return null;
  }

  const trimmed = value!.trim();
  const resolved = resolveTimeZone(trimmed);

  if (!resolved) {
    log.warn(`[Config] ${name} must be a valid IANA timezone (got "${value}"). Ignoring the env var.`);
    return null;
  }

  return resolved;
}

export function parseHistoryRetentionDaysEnv(value: string | undefined, name: string): number {
  if (!hasConfiguredValue(value)) {
    return 7;
  }

  const parsed = parseInt(value!.trim(), 10);
  if (isNaN(parsed) || parsed < -1) {
    log.warn(`[Config] ${name} must be -1 or a non-negative integer (got "${value}"). Falling back to 7.`);
    return 7;
  }

  return parsed;
}

export function resolveLocaleForConfiguredTimeZone(timeZone: string | null): string | null {
  return resolveLocaleFromTimeZone(timeZone);
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

export type CleanupCheckedItemsMode = 'all' | 'synced_only';

export function parseCleanupCheckedItemsAfterHoursEnv(
  value: string | undefined,
  name: string,
): number {
  if (!hasConfiguredValue(value)) {
    return -1;
  }

  const parsed = parseInt(value!.trim(), 10);
  if (isNaN(parsed) || (parsed < 1 && parsed !== -1)) {
    log.warn(`[Config] ${name} must be -1 (disabled) or a positive integer (got "${value}"). Falling back to -1.`);
    return -1;
  }

  return parsed;
}

export function parseCleanupCheckedItemsModeEnv(
  value: string | undefined,
  name: string,
): CleanupCheckedItemsMode {
  if (!hasConfiguredValue(value)) {
    return 'all';
  }

  switch (value!.trim().toLowerCase()) {
    case 'all':
      return 'all';
    case 'synced_only':
      return 'synced_only';
    default:
      log.warn(`[Config] ${name} must be "all" or "synced_only" (got "${value}"). Falling back to all.`);
      return 'all';
  }
}

export function parseBoundedIntEnv(
  value: string | undefined,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (!hasConfiguredValue(value)) {
    return defaultValue;
  }

  const parsed = parseInt(value!.trim(), 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    log.warn(
      `[Config] ${name} must be an integer between ${min} and ${max} (got "${value}"). Falling back to ${defaultValue}.`,
    );
    return defaultValue;
  }

  return parsed;
}

const configuredTimeZone = parseTimeZoneEnv(process.env.TZ, 'TZ');
const configuredLocale = resolveLocaleForConfiguredTimeZone(configuredTimeZone);
const configuredHistoryRetentionDays = parseHistoryRetentionDaysEnv(
  process.env.HISTORY_RETENTION_DAYS,
  'HISTORY_RETENTION_DAYS',
);

export const config = {
  grocyUrl: validateServiceUrl(process.env.GROCY_URL, 'GROCY_URL', GROCY_DEFAULT_URL),
  grocyApiKey: process.env.GROCY_API_KEY || '',
  mealieUrl: validateServiceUrl(process.env.MEALIE_URL, 'MEALIE_URL', MEALIE_DEFAULT_URL),
  mealieApiToken: process.env.MEALIE_API_TOKEN || '',
  mcpEnabled: parseBooleanEnv(process.env.MCP_ENABLED, false, 'MCP_ENABLED'),
  mcpSessionTtlMs: parseBoundedIntEnv(process.env.MCP_SESSION_TTL_MS, 'MCP_SESSION_TTL_MS', 900_000, 60_000, 86_400_000),
  mcpMaxSessions: parseBoundedIntEnv(process.env.MCP_MAX_SESSIONS, 'MCP_MAX_SESSIONS', 100, 1, 1_000),
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
  cleanupCheckedItemsAfterHours: parseCleanupCheckedItemsAfterHoursEnv(
    process.env.CLEANUP_CHECKED_ITEMS_AFTER_HOURS,
    'CLEANUP_CHECKED_ITEMS_AFTER_HOURS',
  ),
  cleanupCheckedItemsMode: parseCleanupCheckedItemsModeEnv(
    process.env.CLEANUP_CHECKED_ITEMS_MODE,
    'CLEANUP_CHECKED_ITEMS_MODE',
  ),
  healthchecksPingUrl: parseOptionalUrlEnv(process.env.HEALTHCHECKS_PING_URL, 'HEALTHCHECKS_PING_URL'),
  allowInsecureTls: parseBooleanEnv(
    process.env.ALLOW_INSECURE_TLS,
    false,
    'ALLOW_INSECURE_TLS',
  ),
  historyEnabled: configuredHistoryRetentionDays !== -1,
  historyRetentionDays: configuredHistoryRetentionDays === -1 ? null : configuredHistoryRetentionDays,
  timeZone: configuredTimeZone,
  timeZoneLocale: configuredLocale,
  notificationWebhookUrl: parseOptionalUrlEnv(process.env.NOTIFICATION_WEBHOOK_URL, 'NOTIFICATION_WEBHOOK_URL'),
  notificationWebhookMode: parseWebhookModeEnv(process.env.NOTIFICATION_WEBHOOK_MODE, 'NOTIFICATION_WEBHOOK_MODE'),
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
    cleanupCheckedItemsAfterHours: hasConfiguredValue(process.env.CLEANUP_CHECKED_ITEMS_AFTER_HOURS),
    cleanupCheckedItemsMode: hasConfiguredValue(process.env.CLEANUP_CHECKED_ITEMS_MODE),
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
    cleanupCheckedItemsAfterHours: process.env.CLEANUP_CHECKED_ITEMS_AFTER_HOURS?.trim() || null,
    cleanupCheckedItemsMode: process.env.CLEANUP_CHECKED_ITEMS_MODE?.trim() || null,
  },
};
