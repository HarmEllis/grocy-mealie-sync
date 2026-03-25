import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: {
    mealieFoodId: 'mealie_food_id',
  },
  unitMappingsTable: {},
  mealieFoods: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  existingProductMappings: [] as Array<Record<string, unknown>>,
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  insertValuesCalls: [] as Array<Record<string, unknown>>,
  conflictCalls: [] as Array<Record<string, unknown>>,
  updateGrocyEntity: vi.fn().mockResolvedValue(undefined),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  productMappings: mockState.productMappingsTable,
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async (table: unknown) => {
        if (table === mockState.productMappingsTable) {
          return mockState.existingProductMappings;
        }
        if (table === mockState.unitMappingsTable) {
          return mockState.unitMappingsRows;
        }

        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mockState.insertValuesCalls.push(values);
        return {
          onConflictDoUpdate: vi.fn(async (args: Record<string, unknown>) => {
            mockState.conflictCalls.push(args);
          }),
        };
      }),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'products') {
      return mockState.grocyProducts;
    }

    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
  updateGrocyEntity: mockState.updateGrocyEntity,
}));

vi.mock('@/lib/mealie', () => ({
  RecipesFoodsService: {
    getAllApiFoodsGet: vi.fn(async () => ({ items: mockState.mealieFoods })),
  },
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
    info: mockState.logInfo,
  },
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

import { POST } from '../products/sync/route';

describe('mapping wizard product sync route', () => {
  beforeEach(() => {
    mockState.mealieFoods = [];
    mockState.grocyProducts = [];
    mockState.existingProductMappings = [];
    mockState.unitMappingsRows = [];
    mockState.insertValuesCalls = [];
    mockState.conflictCalls = [];

    mockState.updateGrocyEntity.mockClear();
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('persists refreshed product names after renaming a linked Grocy product', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Optimel Drinkyogurt' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Optimel' },
    ];
    mockState.existingProductMappings = [
      {
        mealieFoodId: 'food-1',
        mealieFoodName: 'Optimel',
        grocyProductId: 55,
        grocyProductName: 'Optimel',
      },
    ];
    mockState.unitMappingsRows = [
      { id: 'unit-map-1', grocyUnitId: 10 },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieFoodId: 'food-1', grocyProductId: 101, grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ synced: 1, renamed: 1 });
    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('products', 101, {
      name: 'Optimel Drinkyogurt',
    });
    expect(mockState.insertValuesCalls).toHaveLength(1);
    expect(mockState.insertValuesCalls[0]).toEqual(expect.objectContaining({
      mealieFoodId: 'food-1',
      mealieFoodName: 'Optimel Drinkyogurt',
      grocyProductId: 101,
      grocyProductName: 'Optimel Drinkyogurt',
      unitMappingId: 'unit-map-1',
    }));
    expect(mockState.conflictCalls).toHaveLength(1);
    expect(mockState.conflictCalls[0]).toEqual(expect.objectContaining({
      set: expect.objectContaining({
        mealieFoodName: 'Optimel Drinkyogurt',
        grocyProductId: 101,
        grocyProductName: 'Optimel Drinkyogurt',
        unitMappingId: 'unit-map-1',
      }),
    }));
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });
});
