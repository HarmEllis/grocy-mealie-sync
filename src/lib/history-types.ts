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
  'mapping_product_sync',
  'mapping_product_unmap',
  'mapping_product_normalize',
  'mapping_product_delete_orphans',
  'mapping_unit_create',
  'mapping_unit_sync',
  'mapping_unit_unmap',
  'mapping_unit_normalize',
  'mapping_unit_delete_orphans',
  'conflict_remap',
] as const;
export type HistoryRunAction = (typeof historyRunActions)[number];

export type HistoryRunStatus = 'success' | 'partial' | 'failure' | 'skipped';
export type HistoryEventLevel = 'info' | 'warning' | 'error';
export type HistoryEventCategory = 'sync' | 'conflict' | 'mapping' | 'notification' | 'lock' | 'system';
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
