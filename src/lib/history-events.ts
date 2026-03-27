import type { MappingConflictCheckResult, MappingConflictRecord } from './mapping-conflicts-store';
import type { HistoryEventInput, HistoryRunAction, HistoryRunStatus } from './history-store';
import type { GrocyMissingStockPollResult } from './sync/grocy-to-mealie';
import type { MealieInPossessionSyncResult } from './sync/mealie-in-possession';
import type { MealieToGrocyPollResult } from './sync/mealie-to-grocy';
import type { FullProductSyncResult } from './sync/product-sync';

export interface HistoryOutcome {
  status: HistoryRunStatus;
  message: string;
  summary: unknown;
  events: HistoryEventInput[];
}

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
  }
}

export function formatHistoryTriggerLabel(trigger: 'scheduler' | 'manual'): string {
  return trigger === 'scheduler' ? 'Scheduler' : 'Manual';
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
      level: result.summary.unmappedProducts > 0 ? 'warning' : 'info',
      category: 'sync',
      entityKind: 'shopping_item',
      entityRef: action,
      message: action === 'ensure_low_stock'
        ? 'Ensure low-stock sync completed.'
        : 'Grocy to Mealie sync completed.',
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
      message: `In possession sync ${result.inPossessionStatus}.`,
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
        level: result.summary.failedItems > 0 ? 'warning' : 'info',
        category: 'sync',
        entityKind: 'shopping_item',
        entityRef: 'mealie-to-grocy',
        message: 'Mealie to Grocy sync completed.',
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
        level: result.summary.failedProducts > 0 ? 'warning' : 'info',
        category: 'sync',
        entityKind: 'product',
        entityRef: 'in-possession',
        message: 'In possession reconcile completed.',
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
      ? `Opened conflict: ${conflict.summary}`
      : `Resolved conflict: ${conflict.summary}`,
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
  return {
    status: 'success',
    message: `Detected ${result.summary.detected} conflict(s); opened ${result.summary.opened}; resolved ${result.summary.resolved}; ${result.summary.open} still open.`,
    summary: result.summary,
    events: [
      {
        level: result.summary.opened > 0 ? 'warning' : 'info',
        category: 'conflict',
        entityKind: 'conflict',
        entityRef: 'conflict-check',
        message: 'Conflict check completed.',
        details: result.summary,
      },
      ...result.openedConflicts.map(conflict => buildConflictDetailEvent(conflict, 'opened')),
      ...result.resolvedConflicts.map(conflict => buildConflictDetailEvent(conflict, 'resolved')),
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
