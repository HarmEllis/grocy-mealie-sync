export const historyRunTriggers = ['scheduler', 'manual'] as const;
export type HistoryRunTrigger = (typeof historyRunTriggers)[number];

export const historyRunActions = [
  'scheduler_cycle',
  'product_sync',
  'grocy_to_mealie',
  'ensure_low_stock',
  'reconcile_in_possession',
  'mealie_to_grocy',
  'conflict_check',
  'clear_sync_locks',
  'settings_update',
  'mapping_product_create',
  'mapping_product_create_mealie',
  'mapping_product_create_both',
  'mapping_product_sync',
  'mapping_product_unmap',
  'mapping_product_normalize',
  'mapping_product_delete_orphans',
  'product_update_basic',
  'product_update_stock_settings',
  'product_delete',
  'product_update_units',
  'mapping_unit_create',
  'mapping_unit_create_mealie',
  'mapping_unit_sync',
  'mapping_unit_unmap',
  'mapping_unit_normalize',
  'mapping_unit_delete_orphans',
  'unit_update_grocy',
  'unit_update_mealie',
  'inventory_add_stock',
  'inventory_consume_stock',
  'inventory_set_stock',
  'inventory_mark_opened',
  'shopping_add_item',
  'shopping_update_item',
  'shopping_update_unit',
  'shopping_remove_item',
  'shopping_merge_duplicates',
  'shopping_cleanup',
  'conflict_remap',
] as const;
export type HistoryRunAction = (typeof historyRunActions)[number];

export const historyRunStatuses = ['success', 'partial', 'failure', 'skipped'] as const;
export type HistoryRunStatus = (typeof historyRunStatuses)[number];
export type HistoryEventLevel = 'info' | 'warning' | 'error';
export type HistoryEventCategory =
  | 'sync'
  | 'conflict'
  | 'mapping'
  | 'notification'
  | 'lock'
  | 'system'
  | 'product'
  | 'inventory'
  | 'shopping';
export type HistoryEventEntityKind =
  | 'product'
  | 'unit'
  | 'shopping_item'
  | 'conflict'
  | 'lock'
  | 'system'
  | null;

export function isHistoryRunAction(value: string): value is HistoryRunAction {
  return historyRunActions.includes(value as HistoryRunAction);
}

export function isHistoryRunTrigger(value: string): value is HistoryRunTrigger {
  return historyRunTriggers.includes(value as HistoryRunTrigger);
}

export function isHistoryRunStatus(value: string): value is HistoryRunStatus {
  return historyRunStatuses.includes(value as HistoryRunStatus);
}
