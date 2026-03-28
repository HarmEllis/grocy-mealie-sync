import { describe, expect, it } from 'vitest';
import {
  buildConflictCheckHistoryOutcome,
  buildGrocyToMealieHistoryOutcome,
  buildMealieToGrocyHistoryOutcome,
  getVisibleHistoryEvents,
  normalizeHistoryEventMessage,
} from '../history-events';

describe('history events', () => {
  it('describes conflict checks with product and unit breakdowns', () => {
    const outcome = buildConflictCheckHistoryOutcome({
      conflicts: [
        {
          id: 'conflict-product-open',
          conflictKey: 'product-open',
          type: 'missing_grocy_product',
          status: 'open',
          severity: 'error',
          mappingKind: 'product',
          mappingId: 'product-map-1',
          sourceTab: 'products',
          mealieId: 'food-1',
          mealieName: 'Tomaat',
          grocyId: 10,
          grocyName: 'Tomaat',
          summary: 'Mapped Grocy product "Tomaat" no longer exists.',
          occurrences: 1,
          firstSeenAt: new Date('2026-03-28T08:00:00.000Z'),
          lastSeenAt: new Date('2026-03-28T08:05:00.000Z'),
          resolvedAt: null,
        },
        {
          id: 'conflict-unit-open',
          conflictKey: 'unit-open',
          type: 'missing_grocy_unit',
          status: 'open',
          severity: 'error',
          mappingKind: 'unit',
          mappingId: 'unit-map-1',
          sourceTab: 'units',
          mealieId: 'unit-1',
          mealieName: 'Zak',
          grocyId: 9,
          grocyName: 'Zak',
          summary: 'Mapped Grocy unit "Zak" no longer exists.',
          occurrences: 1,
          firstSeenAt: new Date('2026-03-28T08:00:00.000Z'),
          lastSeenAt: new Date('2026-03-28T08:05:00.000Z'),
          resolvedAt: null,
        },
      ],
      openedConflicts: [
        {
          id: 'conflict-product-open',
          conflictKey: 'product-open',
          type: 'missing_grocy_product',
          status: 'open',
          severity: 'error',
          mappingKind: 'product',
          mappingId: 'product-map-1',
          sourceTab: 'products',
          mealieId: 'food-1',
          mealieName: 'Tomaat',
          grocyId: 10,
          grocyName: 'Tomaat',
          summary: 'Mapped Grocy product "Tomaat" no longer exists.',
          occurrences: 1,
          firstSeenAt: new Date('2026-03-28T08:00:00.000Z'),
          lastSeenAt: new Date('2026-03-28T08:05:00.000Z'),
          resolvedAt: null,
        },
      ],
      resolvedConflicts: [
        {
          id: 'conflict-unit-resolved',
          conflictKey: 'unit-resolved',
          type: 'missing_mealie_unit',
          status: 'resolved',
          severity: 'error',
          mappingKind: 'unit',
          mappingId: 'unit-map-2',
          sourceTab: 'units',
          mealieId: 'unit-2',
          mealieName: 'Fles',
          grocyId: 12,
          grocyName: 'Fles',
          summary: 'Mapped Mealie unit "Fles" no longer exists.',
          occurrences: 2,
          firstSeenAt: new Date('2026-03-27T08:00:00.000Z'),
          lastSeenAt: new Date('2026-03-28T08:05:00.000Z'),
          resolvedAt: new Date('2026-03-28T08:05:00.000Z'),
        },
      ],
      summary: {
        detected: 2,
        opened: 1,
        resolved: 1,
        open: 2,
      },
    });

    expect(outcome.message).toBe(
      'Detected 2 conflict(s) (1 product, 1 unit); opened 1 (1 product); resolved 1 (1 unit); 2 still open.',
    );
    expect(outcome.events[0]).toEqual(
      expect.objectContaining({
        message: 'Completed. Open conflicts: 1 product, 1 unit.',
        details: expect.objectContaining({
          byMappingKind: {
            open: { product: 1, unit: 1 },
            opened: { product: 1, unit: 0 },
            resolved: { product: 0, unit: 1 },
          },
        }),
      }),
    );
    expect(outcome.events[1]?.message).toContain('Opened product mapping conflict');
    expect(outcome.events[2]?.message).toContain('Resolved unit mapping conflict');
  });

  it('hides generic scheduler step markers when detailed step events exist', () => {
    const visibleEvents = getVisibleHistoryEvents([
      {
        id: 'event-1',
        runId: 'run-1',
        level: 'info',
        category: 'sync',
        entityKind: 'shopping_item',
        entityRef: 'grocy_to_mealie',
        message: 'Grocy to Mealie: Sync completed.',
        details: null,
        createdAt: new Date('2026-03-28T08:00:00.000Z'),
      },
      {
        id: 'event-2',
        runId: 'run-1',
        level: 'info',
        category: 'sync',
        entityKind: null,
        entityRef: 'grocy_to_mealie',
        message: 'Grocy to Mealie step failure.',
        details: null,
        createdAt: new Date('2026-03-28T08:00:00.000Z'),
      },
      {
        id: 'event-3',
        runId: 'run-1',
        level: 'info',
        category: 'conflict',
        entityKind: null,
        entityRef: 'conflict_check',
        message: 'Conflict check step success.',
        details: null,
        createdAt: new Date('2026-03-28T08:00:00.000Z'),
      },
    ]);

    expect(visibleEvents.map(event => event.message)).toEqual([
      'Grocy to Mealie: Sync completed.',
      'Conflict check step success.',
    ]);
  });

  it('normalizes duplicate event prefixes for display', () => {
    expect(normalizeHistoryEventMessage('Grocy to Mealie: Grocy to Mealie sync completed.')).toBe(
      'Grocy to Mealie: Sync completed.',
    );
    expect(normalizeHistoryEventMessage('Conflict check: Conflict check completed. Open conflicts: none.')).toBe(
      'Conflict check: Completed. Open conflicts: none.',
    );
    expect(normalizeHistoryEventMessage('Product sync step success.')).toBe(
      'Product sync step success.',
    );
  });

  it('describes failed sync events as failures instead of completed work', () => {
    expect(buildMealieToGrocyHistoryOutcome({
      status: 'error',
      summary: {
        checkedItems: 0,
        restockedProducts: 0,
        failedItems: 0,
      },
    }).events[0]).toEqual(expect.objectContaining({
      level: 'error',
      message: 'Sync failed.',
    }));

    expect(buildGrocyToMealieHistoryOutcome('grocy_to_mealie', {
      status: 'error',
      summary: {
        processedProducts: 0,
        ensuredProducts: 0,
        unmappedProducts: 0,
      },
    }).events[0]).toEqual(expect.objectContaining({
      level: 'error',
      message: 'Sync failed.',
    }));
  });
});
