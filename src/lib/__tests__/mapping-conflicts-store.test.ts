import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  sqliteExec: vi.fn(),
  mappingConflictsTable: {
    id: 'mapping_conflicts.id',
  },
  productMappingsTable: {},
  unitMappingsTable: {},
  mappingConflictsRows: [] as Array<Record<string, any>>,
  productMappingRows: [] as Array<Record<string, any>>,
  unitMappingRows: [] as Array<Record<string, any>>,
  detectedConflicts: [] as Array<Record<string, any>>,
  updateCalls: [] as Array<Record<string, any>>,
  insertCalls: [] as Array<Record<string, any>>,
  getAllApiFoodsGet: vi.fn(async () => []),
  getAllApiUnitsGet: vi.fn(async () => []),
  extractFoods: vi.fn(() => []),
  extractUnits: vi.fn(() => []),
  getGrocyEntities: vi.fn(async () => []),
  detectMappingConflicts: vi.fn(() => mockState.detectedConflicts),
}));

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ left, right }),
}));

vi.mock('../db/schema', () => ({
  mappingConflicts: mockState.mappingConflictsTable,
  productMappings: mockState.productMappingsTable,
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('../db', () => ({
  sqlite: {
    exec: mockState.sqliteExec,
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async (table: unknown) => {
        if (table === mockState.mappingConflictsTable) {
          return mockState.mappingConflictsRows;
        }

        if (table === mockState.productMappingsTable) {
          return mockState.productMappingRows;
        }

        if (table === mockState.unitMappingsTable) {
          return mockState.unitMappingRows;
        }

        return [];
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, any>) => ({
        where: vi.fn(async (clause: { right: string }) => {
          mockState.updateCalls.push({ table, values, clause });

          if (table !== mockState.mappingConflictsTable) {
            return;
          }

          const row = mockState.mappingConflictsRows.find(conflict => conflict.id === clause.right);
          if (row) {
            Object.assign(row, values);
          }
        }),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: Record<string, any>) => {
        mockState.insertCalls.push({ table, values });

        if (table === mockState.mappingConflictsTable) {
          mockState.mappingConflictsRows.push(values);
        }
      }),
    })),
  },
}));

vi.mock('../mealie', () => ({
  RecipesFoodsService: {
    getAllApiFoodsGet: mockState.getAllApiFoodsGet,
  },
  RecipesUnitsService: {
    getAllApiUnitsGet: mockState.getAllApiUnitsGet,
  },
}));

vi.mock('../mealie/types', () => ({
  extractFoods: mockState.extractFoods,
  extractUnits: mockState.extractUnits,
}));

vi.mock('../grocy/types', () => ({
  getGrocyEntities: mockState.getGrocyEntities,
}));

vi.mock('../mapping-conflicts-detection', () => ({
  detectMappingConflicts: mockState.detectMappingConflicts,
}));

import { listOpenMappingConflicts, runMappingConflictCheck } from '../mapping-conflicts-store';

describe('mapping conflict store', () => {
  beforeEach(() => {
    mockState.sqliteExec.mockReset();
    mockState.mappingConflictsRows = [];
    mockState.productMappingRows = [];
    mockState.unitMappingRows = [];
    mockState.detectedConflicts = [];
    mockState.updateCalls = [];
    mockState.insertCalls = [];
    mockState.getAllApiFoodsGet.mockClear();
    mockState.getAllApiUnitsGet.mockClear();
    mockState.extractFoods.mockClear();
    mockState.extractUnits.mockClear();
    mockState.getGrocyEntities.mockClear();
    mockState.detectMappingConflicts.mockClear();
  });

  it('reopens a previously resolved conflict with the same key instead of inserting a duplicate row', async () => {
    mockState.mappingConflictsRows = [
      {
        id: 'conflict-1',
        conflictKey: 'missing_mealie_food:product:product-map-1',
        type: 'missing_mealie_food',
        status: 'resolved',
        severity: 'error',
        mappingKind: 'product',
        mappingId: 'product-map-1',
        sourceTab: 'products',
        mealieId: 'food-1',
        mealieName: 'Milk',
        grocyId: 101,
        grocyName: 'Milk',
        summary: 'Old summary',
        occurrences: 3,
        firstSeenAt: new Date('2026-03-27T10:00:00.000Z'),
        lastSeenAt: new Date('2026-03-27T10:05:00.000Z'),
        resolvedAt: new Date('2026-03-27T10:10:00.000Z'),
      },
    ];
    mockState.detectedConflicts = [
      {
        key: 'missing_mealie_food:product:product-map-1',
        type: 'missing_mealie_food',
        mappingKind: 'product',
        mappingId: 'product-map-1',
        sourceTab: 'products',
        severity: 'error',
        mealieId: 'food-1',
        mealieName: 'Milk',
        grocyId: 101,
        grocyName: 'Milk',
        summary: 'Mapped Mealie product "Milk" no longer exists.',
      },
    ];

    const result = await runMappingConflictCheck();

    expect(mockState.insertCalls).toEqual([]);
    expect(mockState.updateCalls).toHaveLength(1);
    expect(result.summary).toEqual({
      detected: 1,
      opened: 1,
      resolved: 0,
      open: 1,
    });
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        id: 'conflict-1',
        status: 'open',
        occurrences: 4,
        summary: 'Mapped Mealie product "Milk" no longer exists.',
      }),
    ]);
  });

  it('marks stale open conflicts as resolved when they are no longer detected', async () => {
    mockState.mappingConflictsRows = [
      {
        id: 'conflict-1',
        conflictKey: 'missing_grocy_unit:unit:unit-map-1',
        type: 'missing_grocy_unit',
        status: 'open',
        severity: 'error',
        mappingKind: 'unit',
        mappingId: 'unit-map-1',
        sourceTab: 'units',
        mealieId: 'unit-1',
        mealieName: 'Liter',
        grocyId: 10,
        grocyName: 'Liter',
        summary: 'Mapped Grocy unit "Liter" no longer exists.',
        occurrences: 1,
        firstSeenAt: new Date('2026-03-27T10:00:00.000Z'),
        lastSeenAt: new Date('2026-03-27T10:05:00.000Z'),
        resolvedAt: null,
      },
    ];

    const result = await runMappingConflictCheck();

    expect(mockState.insertCalls).toEqual([]);
    expect(mockState.updateCalls).toHaveLength(1);
    expect(result.summary).toEqual({
      detected: 0,
      opened: 0,
      resolved: 1,
      open: 0,
    });
    expect(await listOpenMappingConflicts()).toEqual([]);
    expect(mockState.mappingConflictsRows[0]).toEqual(
      expect.objectContaining({
        id: 'conflict-1',
        status: 'resolved',
      }),
    );
  });
});
