export const API_ENDPOINTS = [
  ['GET', '/api/health', 'Health check'],
  ['GET', '/api/status', 'Sync status'],
  ['GET', '/api/mappings/products', 'Product mappings'],
  ['GET', '/api/mappings/units', 'Unit mappings'],
  ['POST', '/api/sync/products', 'Trigger product sync'],
  ['POST', '/api/sync/grocy-to-mealie', 'Trigger Grocy to Mealie check'],
  ['POST', '/api/sync/grocy-to-mealie/ensure', 'Ensure below-min items on Mealie list'],
  ['POST', '/api/sync/grocy-to-mealie/in-possession', 'Reconcile Mealie in possession from Grocy stock'],
  ['POST', '/api/sync/mealie-to-grocy', 'Trigger Mealie to Grocy check'],
  ['POST', '/api/sync/shopping-cleanup', 'Run shopping list cleanup'],
  ['POST', '/api/sync/unlock', 'Clear scheduler and sync locks'],
] as const;
