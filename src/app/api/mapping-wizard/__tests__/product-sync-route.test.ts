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
  recordHistoryRun: vi.fn(),
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

vi.mock('@/lib/history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
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
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
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
    expect(body).toEqual({ synced: 1, renamed: 1, renameFailed: 0, skipped: 0, conflicts: [] });
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
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_product_sync',
      status: 'success',
    }));
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('skips and reports a Grocy product already mapped to another Mealie food', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Optimel Drinkyogurt' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Optimel' },
    ];
    mockState.existingProductMappings = [
      {
        mealieFoodId: 'food-2',
        mealieFoodName: 'Other Food',
        grocyProductId: 101,
        grocyProductName: 'Optimel',
      },
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

    // Previously a 409 that discarded the whole request. Chunked bulk runs make
    // that unacceptable: one stale duplicate would throw away up to 499 valid
    // mappings in the same chunk and halt the run partway down the list.
    expect(response.status).toBe(200);
    expect(body).toEqual({
      synced: 0,
      renamed: 0,
      renameFailed: 0,
      skipped: 1,
      conflicts: [{
        mealieFoodId: 'food-1',
        grocyProductId: 101,
        reason: 'Grocy product "Optimel" (#101) is already mapped to Mealie food "Other Food".',
      }],
    });
    expect(mockState.insertValuesCalls).toHaveLength(0);
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('still applies the valid entries alongside a conflicting one', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Optimel Drinkyogurt' },
      { id: 'food-3', name: 'Kwark' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Optimel' },
      { id: 103, name: 'Kwark' },
    ];
    mockState.existingProductMappings = [
      {
        mealieFoodId: 'food-2',
        mealieFoodName: 'Other Food',
        grocyProductId: 101,
        grocyProductName: 'Optimel',
      },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieFoodId: 'food-1', grocyProductId: 101, grocyUnitId: 10 },
          { mealieFoodId: 'food-3', grocyProductId: 103, grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.synced).toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.conflicts).toHaveLength(1);
    expect(mockState.insertValuesCalls).toHaveLength(1);
  });

  it('skips ALL duplicate groups, not just the first one', async () => {
    // Regression: the shared helper reports only the first duplicate group, so
    // a second group used to reach the DB and violate the unique index
    // mid-loop, leaving partial writes behind a 500.
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Buttermilk' },
      { id: 'food-3', name: 'Kwark' },
      { id: 'food-4', name: 'Skyr' },
      { id: 'food-5', name: 'Cheese' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Milk' },
      { id: 102, name: 'Kwark' },
      { id: 103, name: 'Cheese' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieFoodId: 'food-1', grocyProductId: 101, grocyUnitId: 10 },
          { mealieFoodId: 'food-2', grocyProductId: 101, grocyUnitId: 10 },
          { mealieFoodId: 'food-3', grocyProductId: 102, grocyUnitId: 10 },
          { mealieFoodId: 'food-4', grocyProductId: 102, grocyUnitId: 10 },
          { mealieFoodId: 'food-5', grocyProductId: 103, grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.skipped).toBe(4);
    expect(body.synced).toBe(1);
    expect(body.conflicts).toHaveLength(4);
    // Only the single non-conflicting entry may be written.
    expect(mockState.insertValuesCalls).toHaveLength(1);
    expect(mockState.insertValuesCalls[0]).toEqual(expect.objectContaining({ mealieFoodId: 'food-5' }));
  });

  it('records skipped conflicts as a partial run, not a clean success', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Buttermilk' },
    ];
    mockState.grocyProducts = [{ id: 101, name: 'Milk' }];

    await POST(new Request('http://localhost/api/mapping-wizard/products/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieFoodId: 'food-1', grocyProductId: 101, grocyUnitId: 10 },
          { mealieFoodId: 'food-2', grocyProductId: 101, grocyUnitId: 10 },
        ],
      }),
    }));

    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_product_sync',
      status: 'partial',
      summary: expect.objectContaining({ skipped: 2 }),
    }));
  });

  it('skips a Mealie food listed more than once in the same request', async () => {
    mockState.mealieFoods = [{ id: 'food-1', name: 'Milk' }];
    mockState.grocyProducts = [
      { id: 101, name: 'Milk' },
      { id: 102, name: 'Milk Alt' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieFoodId: 'food-1', grocyProductId: 101, grocyUnitId: 10 },
          { mealieFoodId: 'food-1', grocyProductId: 102, grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.synced).toBe(0);
    expect(mockState.insertValuesCalls).toHaveLength(0);
  });

  it('skips every entry claiming the same Grocy product twice in one request', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Buttermilk' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Milk' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieFoodId: 'food-1', grocyProductId: 101, grocyUnitId: 10 },
          { mealieFoodId: 'food-2', grocyProductId: 101, grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    // Both claimants are skipped: picking a winner arbitrarily would silently
    // drop the user's other choice.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ synced: 0, skipped: 2 });
    expect(body.conflicts).toEqual([
      {
        mealieFoodId: 'food-1',
        grocyProductId: 101,
        reason: 'Grocy product #101 is selected for multiple Mealie foods in the same request.',
      },
      {
        mealieFoodId: 'food-2',
        grocyProductId: 101,
        reason: 'Grocy product #101 is selected for multiple Mealie foods in the same request.',
      },
    ]);
    expect(mockState.insertValuesCalls).toHaveLength(0);
  });

  it('records partial history when the Grocy rename fails during product sync', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Optimel Drinkyogurt' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Optimel' },
    ];
    mockState.updateGrocyEntity.mockRejectedValueOnce(new Error('Rename failed'));

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
    expect(body).toEqual({ synced: 1, renamed: 0, renameFailed: 1, skipped: 0, conflicts: [] });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_product_sync',
      status: 'partial',
      summary: expect.objectContaining({
        synced: 1,
        renamed: 0,
        renameFailed: 1,
      }),
    }));
  });
});
