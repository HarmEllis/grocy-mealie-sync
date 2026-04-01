import type { MappingConflictCheckResult, MappingConflictRecord } from './mapping-conflicts-store';
import type { HistoryRunAction, HistoryRunStatus } from './history-types';
import type { HistoryEventInput, HistoryEventRecord } from './history-store';
import type { SchedulerStepName } from './scheduler-notifications';
import type { GrocyMissingStockPollResult } from './sync/grocy-to-mealie';
import type { MealieInPossessionSyncResult } from './sync/mealie-in-possession';
import type { MealieToGrocyPollResult } from './sync/mealie-to-grocy';
import type { FullProductSyncResult } from './sync/product-sync';
import type { ShoppingCleanupResult } from './sync/shopping-cleanup';

export interface HistoryOutcome {
  status: HistoryRunStatus;
  message: string;
  summary: unknown;
  events: HistoryEventInput[];
}

const STEP_MARKER_MESSAGE_PATTERN = /^(.+) step (success|partial|skipped|failed|failure)\.$/;

function toHistoryStatus(status: 'ok' | 'partial' | 'skipped' | 'error'): HistoryRunStatus {
  switch (status) {
    case 'ok':
      return 'success';
    case 'partial':
      return 'partial';
    case 'skipped':
      return 'skipped';
    case 'error':
      return 'failure';
  }
}

function toConflictEventLevel(conflict: Pick<MappingConflictRecord, 'severity'>): 'warning' | 'error' {
  return conflict.severity === 'error' ? 'error' : 'warning';
}

function formatMappingKindLabel(mappingKind: MappingConflictRecord['mappingKind']): string {
  return mappingKind === 'unit' ? 'unit mapping' : 'product mapping';
}

function countConflictsByMappingKind(conflicts: Array<Pick<MappingConflictRecord, 'mappingKind'>>): {
  product: number;
  unit: number;
} {
  return conflicts.reduce(
    (counts, conflict) => {
      if (conflict.mappingKind === 'unit') {
        counts.unit++;
      } else {
        counts.product++;
      }

      return counts;
    },
    { product: 0, unit: 0 },
  );
}

function formatConflictKindBreakdown(conflicts: Array<Pick<MappingConflictRecord, 'mappingKind'>>): string {
  const counts = countConflictsByMappingKind(conflicts);
  const parts: string[] = [];

  if (counts.product > 0) {
    parts.push(`${counts.product} product`);
  }

  if (counts.unit > 0) {
    parts.push(`${counts.unit} unit`);
  }

  if (parts.length === 0) {
    return 'none';
  }

  return parts.join(', ');
}

export function formatHistoryActionLabel(action: HistoryRunAction): string {
  switch (action) {
    case 'scheduler_cycle':
      return 'Scheduler cycle';
    case 'product_sync':
      return 'Product sync';
    case 'grocy_to_mealie':
      return 'Grocy to Mealie';
    case 'ensure_low_stock':
      return 'Ensure low stock';
    case 'reconcile_in_possession':
      return 'Reconcile in possession';
    case 'mealie_to_grocy':
      return 'Mealie to Grocy';
    case 'conflict_check':
      return 'Conflict check';
    case 'clear_sync_locks':
      return 'Clear sync locks';
    case 'settings_update':
      return 'Settings update';
    case 'mapping_product_create':
      return 'Create Grocy products';
    case 'mapping_product_create_mealie':
      return 'Create Mealie products';
    case 'mapping_product_create_both':
      return 'Create Grocy + Mealie products';
    case 'mapping_product_sync':
      return 'Map products';
    case 'mapping_product_unmap':
      return 'Unmap product';
    case 'mapping_product_normalize':
      return 'Normalize products';
    case 'mapping_product_delete_orphans':
      return 'Delete orphan products';
    case 'product_update_basic':
      return 'Update product metadata';
    case 'product_update_stock_settings':
      return 'Update Grocy stock settings';
    case 'mapping_unit_create':
      return 'Create Grocy units';
    case 'mapping_unit_create_mealie':
      return 'Create Mealie units';
    case 'mapping_unit_sync':
      return 'Map units';
    case 'mapping_unit_unmap':
      return 'Unmap unit';
    case 'mapping_unit_normalize':
      return 'Normalize units';
    case 'mapping_unit_delete_orphans':
      return 'Delete orphan units';
    case 'unit_update_grocy':
      return 'Update Grocy unit';
    case 'unit_update_mealie':
      return 'Update Mealie unit';
    case 'inventory_add_stock':
      return 'Add stock';
    case 'inventory_consume_stock':
      return 'Consume stock';
    case 'inventory_set_stock':
      return 'Set stock';
    case 'inventory_mark_opened':
      return 'Mark stock opened';
    case 'shopping_add_item':
      return 'Add shopping item';
    case 'shopping_update_item':
      return 'Update shopping item';
    case 'shopping_remove_item':
      return 'Remove shopping item';
    case 'shopping_merge_duplicates':
      return 'Merge shopping duplicates';
    case 'shopping_cleanup':
      return 'Shopping list cleanup';
    case 'conflict_remap':
      return 'Resolve conflict';
  }
}

export function formatHistoryTriggerLabel(trigger: 'scheduler' | 'manual'): string {
  return trigger === 'scheduler' ? 'Scheduler' : 'Manual';
}

export function formatSchedulerStepNameLabel(stepName: SchedulerStepName): string {
  switch (stepName) {
    case 'product_sync':
      return 'Product sync';
    case 'mealie_to_grocy':
      return 'Mealie to Grocy';
    case 'grocy_to_mealie':
      return 'Grocy to Mealie';
    case 'conflict_check':
      return 'Conflict check';
    case 'shopping_cleanup':
      return 'Shopping cleanup';
  }
}

export function formatHistoryStatusLabel(status: HistoryRunStatus): string {
  switch (status) {
    case 'success':
      return 'Success';
    case 'partial':
      return 'Partial';
    case 'failure':
      return 'Failure';
    case 'skipped':
      return 'Skipped';
  }
}

export function buildProductSyncHistoryOutcome(result: FullProductSyncResult): HistoryOutcome {
  const units = result.summary.units;
  const products = result.summary.products;

  return {
    status: 'success',
    message: `Units: ${units.created} created, ${units.linked} linked, ${units.skipped} skipped. Products: ${products.created} created, ${products.linked} linked, ${products.skipped} skipped.`,
    summary: result.summary,
    events: [
      {
        level: 'info',
        category: 'sync',
        entityKind: 'unit',
        entityRef: 'units',
        message: 'Unit sync completed.',
        details: units,
      },
      {
        level: 'info',
        category: 'sync',
        entityKind: 'product',
        entityRef: 'products',
        message: 'Product sync completed.',
        details: products,
      },
      ...(products.backfilled > 0
        ? [{
          level: 'info' as const,
          category: 'mapping' as const,
          entityKind: 'product' as const,
          entityRef: 'products',
          message: `Backfilled ${products.backfilled} product mapping${products.backfilled === 1 ? '' : 's'} with missing units.`,
          details: { backfilled: products.backfilled },
        }]
        : []),
    ],
  };
}

export function buildGrocyToMealieHistoryOutcome(
  action: 'grocy_to_mealie' | 'ensure_low_stock',
  result: GrocyMissingStockPollResult,
): HistoryOutcome {
  const lowStockMessage = action === 'ensure_low_stock'
    ? `Processed ${result.summary.processedProducts} low-stock product(s); ensured ${result.summary.ensuredProducts}; unmapped ${result.summary.unmappedProducts}.`
    : `Processed ${result.summary.processedProducts} low-stock product(s); ensured ${result.summary.ensuredProducts}; unmapped ${result.summary.unmappedProducts}.`;

  const events: HistoryEventInput[] = [
    {
      level: result.status === 'error'
        ? 'error'
        : result.status === 'partial' || result.status === 'skipped' || result.summary.unmappedProducts > 0
          ? 'warning'
          : 'info',
      category: 'sync',
      entityKind: 'shopping_item',
      entityRef: action,
      message: result.status === 'error'
        ? 'Sync failed.'
        : result.status === 'skipped'
          ? 'Sync skipped.'
          : result.status === 'partial'
            ? 'Sync partially completed.'
            : 'Sync completed.',
      details: {
        reason: result.reason ?? null,
        summary: result.summary,
      },
    },
  ];

  if (result.inPossessionStatus) {
    events.push({
      level: result.inPossessionStatus === 'error'
        ? 'error'
        : result.inPossessionStatus === 'skipped'
          ? 'warning'
          : 'info',
      category: 'sync',
      entityKind: 'product',
      entityRef: 'in-possession',
      message: `In possession sync ${result.inPossessionStatus === 'ok' ? 'succeeded' : result.inPossessionStatus}.`,
      details: result.inPossessionSummary ?? null,
    });
  }

  return {
    status: toHistoryStatus(result.status),
    message: lowStockMessage,
    summary: {
      reason: result.reason ?? null,
      lowStock: result.summary,
      inPossessionStatus: result.inPossessionStatus ?? null,
      inPossessionSummary: result.inPossessionSummary ?? null,
    },
    events,
  };
}

export function buildMealieToGrocyHistoryOutcome(result: MealieToGrocyPollResult): HistoryOutcome {
  return {
    status: toHistoryStatus(result.status),
    message: `Checked ${result.summary.checkedItems} item(s); restocked ${result.summary.restockedProducts}; failed ${result.summary.failedItems}.`,
    summary: {
      reason: result.reason ?? null,
      ...result.summary,
    },
    events: [
      {
        level: result.status === 'error'
          ? 'error'
          : result.status === 'partial' || result.status === 'skipped' || result.summary.failedItems > 0
            ? 'warning'
            : 'info',
        category: 'sync',
        entityKind: 'shopping_item',
        entityRef: 'mealie-to-grocy',
        message: result.status === 'error'
          ? 'Sync failed.'
          : result.status === 'skipped'
            ? 'Sync skipped.'
            : result.status === 'partial'
              ? 'Sync partially completed.'
              : 'Sync completed.',
        details: {
          reason: result.reason ?? null,
          summary: result.summary,
        },
      },
    ],
  };
}

export function buildInPossessionHistoryOutcome(result: MealieInPossessionSyncResult): HistoryOutcome {
  return {
    status: toHistoryStatus(result.status),
    message: `Processed ${result.summary.processedProducts} product(s); updated ${result.summary.updatedProducts}; enabled ${result.summary.enabledProducts}; disabled ${result.summary.disabledProducts}; failed ${result.summary.failedProducts}.`,
    summary: {
      reason: result.reason ?? null,
      ...result.summary,
    },
    events: [
      {
        level: result.status === 'error'
          ? 'error'
          : result.status === 'skipped' || result.summary.failedProducts > 0
            ? 'warning'
            : 'info',
        category: 'sync',
        entityKind: 'product',
        entityRef: 'in-possession',
        message: result.status === 'error'
          ? 'In possession reconcile failed.'
          : result.status === 'skipped'
            ? 'In possession reconcile skipped.'
            : 'In possession reconcile completed.',
        details: {
          reason: result.reason ?? null,
          summary: result.summary,
        },
      },
    ],
  };
}

function buildConflictDetailEvent(
  conflict: MappingConflictRecord,
  kind: 'opened' | 'resolved',
): HistoryEventInput {
  return {
    level: kind === 'opened' ? toConflictEventLevel(conflict) : 'info',
    category: 'conflict',
    entityKind: 'conflict',
    entityRef: conflict.id,
    message: kind === 'opened'
      ? `Opened ${formatMappingKindLabel(conflict.mappingKind)} conflict: ${conflict.summary}`
      : `Resolved ${formatMappingKindLabel(conflict.mappingKind)} conflict: ${conflict.summary}`,
    details: {
      type: conflict.type,
      severity: conflict.severity,
      mappingKind: conflict.mappingKind,
      mappingId: conflict.mappingId,
      mealieId: conflict.mealieId,
      mealieName: conflict.mealieName,
      grocyId: conflict.grocyId,
      grocyName: conflict.grocyName,
    },
  };
}

export function buildConflictCheckHistoryOutcome(result: MappingConflictCheckResult): HistoryOutcome {
  const detectedBreakdown = formatConflictKindBreakdown(result.conflicts);
  const openedBreakdown = formatConflictKindBreakdown(result.openedConflicts);
  const resolvedBreakdown = formatConflictKindBreakdown(result.resolvedConflicts);
  const hasOpenConflicts = result.summary.open > 0;

  return {
    status: hasOpenConflicts ? 'partial' : 'success',
    message: `Detected ${result.summary.detected} conflict(s) (${detectedBreakdown}); opened ${result.summary.opened} (${openedBreakdown}); resolved ${result.summary.resolved} (${resolvedBreakdown}); ${result.summary.open} still open.`,
    summary: result.summary,
    events: [
      {
        level: hasOpenConflicts ? 'warning' : 'info',
        category: 'conflict',
        entityKind: 'conflict',
        entityRef: 'conflict-check',
        message: `Completed. Open conflicts: ${detectedBreakdown}.`,
        details: {
          ...result.summary,
          byMappingKind: {
            open: countConflictsByMappingKind(result.conflicts),
            opened: countConflictsByMappingKind(result.openedConflicts),
            resolved: countConflictsByMappingKind(result.resolvedConflicts),
          },
        },
      },
      ...result.openedConflicts.map(conflict => buildConflictDetailEvent(conflict, 'opened')),
      ...result.resolvedConflicts.map(conflict => buildConflictDetailEvent(conflict, 'resolved')),
    ],
  };
}

export function buildShoppingCleanupHistoryOutcome(result: ShoppingCleanupResult): HistoryOutcome {
  return {
    status: toHistoryStatus(result.status),
    message: result.status === 'skipped'
      ? `Cleanup skipped: ${result.reason ?? 'unknown'}.`
      : `Eligible ${result.summary.eligibleItems} item(s); removed ${result.summary.removedItems}; skipped ${result.summary.skippedItems}; failed ${result.summary.failedItems}.`,
    summary: {
      reason: result.reason ?? null,
      ...result.summary,
    },
    events: [
      {
        level: result.status === 'error' ? 'error'
          : result.status === 'partial' || result.status === 'skipped' ? 'warning'
            : 'info',
        category: 'shopping',
        entityKind: 'shopping_item',
        entityRef: 'shopping-cleanup',
        message: result.status === 'error' ? 'Cleanup failed.'
          : result.status === 'skipped' ? `Cleanup skipped: ${result.reason ?? 'unknown'}.`
            : result.status === 'partial' ? 'Cleanup partially completed.'
              : 'Cleanup completed.',
        details: {
          reason: result.reason ?? null,
          summary: result.summary,
        },
      },
    ],
  };
}

export function buildClearSyncLocksHistoryOutcome(
  clearedSyncLock: boolean,
  clearedSchedulerLock: boolean,
): HistoryOutcome {
  const clearedCount = [clearedSyncLock, clearedSchedulerLock].filter(Boolean).length;
  const status: HistoryRunStatus = clearedCount === 0 ? 'skipped' : 'success';

  return {
    status,
    message: clearedCount === 0
      ? 'No sync locks were present.'
      : 'Sync locks cleared.',
    summary: {
      clearedSyncLock,
      clearedSchedulerLock,
    },
    events: [
      {
        level: clearedCount === 0 ? 'warning' : 'info',
        category: 'lock',
        entityKind: 'lock',
        entityRef: 'sync-locks',
        message: clearedCount === 0
          ? 'No sync locks were present.'
          : 'Cleared sync locks.',
        details: {
          clearedSyncLock,
          clearedSchedulerLock,
        },
      },
    ],
  };
}

export function prefixHistoryEvents(prefix: string, events: HistoryEventInput[]): HistoryEventInput[] {
  return events.map(event => ({
    ...event,
    message: `${prefix}: ${event.message}`,
  }));
}

export function getVisibleHistoryEvents<T extends Pick<HistoryEventRecord, 'message'>>(events: T[]): T[] {
  const detailedPrefixes = new Set(
    events
      .map(event => {
        const separatorIndex = event.message.indexOf(':');
        if (separatorIndex <= 0) {
          return null;
        }

        return event.message.slice(0, separatorIndex);
      })
      .filter((value): value is string => Boolean(value)),
  );

  return events.filter(event => {
    const stepMarkerMatch = STEP_MARKER_MESSAGE_PATTERN.exec(event.message);
    if (!stepMarkerMatch) {
      return true;
    }

    return !detailedPrefixes.has(stepMarkerMatch[1]);
  });
}

export function normalizeHistoryEventMessage(message: string): string {
  const separator = ': ';
  const separatorIndex = message.indexOf(separator);
  if (separatorIndex <= 0) {
    return message;
  }

  const prefix = message.slice(0, separatorIndex);
  const suffix = message.slice(separatorIndex + separator.length);

  if (!suffix.startsWith(`${prefix} `)) {
    return message;
  }

  const normalizedSuffix = suffix.slice(prefix.length + 1);
  return `${prefix}: ${normalizedSuffix.charAt(0).toUpperCase()}${normalizedSuffix.slice(1)}`;
}
