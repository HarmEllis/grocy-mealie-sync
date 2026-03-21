import dotenv from 'dotenv';
dotenv.config();

export const config = {
  grocyUrl: process.env.GROCY_URL || 'http://grocy:9283',
  grocyApiKey: process.env.GROCY_API_KEY || '',
  mealieUrl: process.env.MEALIE_URL || 'http://mealie:9925',
  mealieApiToken: process.env.MEALIE_API_TOKEN || '',
  mealieShoppingListId: process.env.MEALIE_SHOPPING_LIST_ID || '',
  pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '60', 10),
  productSyncIntervalHours: parseInt(process.env.PRODUCT_SYNC_INTERVAL_HOURS || '6', 10),
  grocyDefaultUnitId: process.env.GROCY_DEFAULT_UNIT_ID ? parseInt(process.env.GROCY_DEFAULT_UNIT_ID, 10) : null,
  databasePath: process.env.DATABASE_PATH || './data/sync.db',
};
