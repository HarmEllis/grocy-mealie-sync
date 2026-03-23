import dotenv from 'dotenv';
import { log } from './logger';
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

export const config = {
  grocyUrl: validateServiceUrl(process.env.GROCY_URL, 'GROCY_URL', GROCY_DEFAULT_URL),
  grocyApiKey: process.env.GROCY_API_KEY || '',
  mealieUrl: validateServiceUrl(process.env.MEALIE_URL, 'MEALIE_URL', MEALIE_DEFAULT_URL),
  mealieApiToken: process.env.MEALIE_API_TOKEN || '',
  mealieShoppingListId: process.env.MEALIE_SHOPPING_LIST_ID || '',
  pollIntervalSeconds: parseIntOrDefault(process.env.POLL_INTERVAL_SECONDS, 60),
  productSyncIntervalHours: parseIntOrDefault(process.env.PRODUCT_SYNC_INTERVAL_HOURS, 6),
  grocyDefaultUnitId: process.env.GROCY_DEFAULT_UNIT_ID
    ? (parseIntOrDefault(process.env.GROCY_DEFAULT_UNIT_ID, 0) || null)
    : null,
  stockOnlyMinStock: process.env.STOCK_ONLY_MIN_STOCK === 'true',
  databasePath: process.env.DATABASE_PATH || './data/sync.db',
};
