import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: { __table: 'product_mappings' },
  unitMappingsTable: { __table: 'unit_mappings' },
  productMappingsRows: [] as Array<Record<string, unknown>>,
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  insertValuesCalls: [] as Array<Record<string, unknown>>,
  createFood: vi.fn(),
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
        if (table === mockState.productMappingsTable) return mockState.productMappingsRows;
        if (table === mockState.unitMappingsTable) return mockState.unitMappingsRows;
        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        mockState.insertValuesCalls.push(values);
      }),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'products') return mockState.grocyProducts;
    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
}));

vi.mock('@/lib/mealie', () => ({
  RecipesFoodsService: {
    createOneApiFoodsPost: mockState.createFood,
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

import { POST } from '../products/create-mealie/route';

describe('mapping wizard create mealie products route', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.unitMappingsRows = [];
    mockState.grocyProducts = [];
    mockState.insertValuesCalls = [];
    mockState.createFood.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('creates Mealie products from Grocy products and stores the mapping', async () => {
    mockState.grocyProducts = [
      { id: 101, name: 'Tomatoes', qu_id_purchase: 10, min_stock_amount: 5 },
      { id: 102, name: 'Mapped Product', qu_id_purchase: 11, min_stock_amount: 2 },
    ];
    mockState.productMappingsRows = [
      { grocyProductId: 102 },
    ];
    mockState.unitMappingsRows = [
      { id: 'unit-map-1', grocyUnitId: 10 },
    ];
    mockState.createFood.mockResolvedValue({
      id: 'food-101',
      name: 'Tomatoes',
    });

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/create-mealie', {
      method: 'POST',
      body: JSON.stringify({
        grocyProductIds: [101, 102],
        unitSelections: { '101': 10, '102': null },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ created: 1, skipped: 1 });
    expect(mockState.createFood).toHaveBeenCalledWith({ name: 'Tomatoes' });
    expect(mockState.insertValuesCalls).toHaveLength(1);
    expect(mockState.insertValuesCalls[0]).toEqual(expect.objectContaining({
      mealieFoodId: 'food-101',
      mealieFoodName: 'Tomatoes',
      grocyProductId: 101,
      grocyProductName: 'Tomatoes',
      unitMappingId: 'unit-map-1',
    }));
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_product_create_mealie',
      status: 'success',
    }));
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('uses the selected Grocy unit when creating the mapping', async () => {
    mockState.grocyProducts = [
      { id: 101, name: 'Tomatoes', qu_id_purchase: 10, min_stock_amount: 5 },
    ];
    mockState.unitMappingsRows = [
      { id: 'unit-map-1', grocyUnitId: 10 },
      { id: 'unit-map-2', grocyUnitId: 11 },
    ];
    mockState.createFood.mockResolvedValue({
      id: 'food-101',
      name: 'Tomatoes',
    });

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/create-mealie', {
      method: 'POST',
      body: JSON.stringify({
        grocyProductIds: [101],
        unitSelections: { '101': 11 },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ created: 1, skipped: 0 });
    expect(mockState.insertValuesCalls).toHaveLength(1);
    expect(mockState.insertValuesCalls[0]).toEqual(expect.objectContaining({
      grocyProductId: 101,
      unitMappingId: 'unit-map-2',
    }));
  });
});
