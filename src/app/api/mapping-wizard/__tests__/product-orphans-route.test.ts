import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: { __table: 'product_mappings' },
  productMappingsRows: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  mealieFoods: [] as Array<Record<string, unknown>>,
  deleteGrocyEntity: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  productMappings: mockState.productMappingsTable,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async () => mockState.productMappingsRows),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async () => mockState.grocyProducts),
  deleteGrocyEntity: mockState.deleteGrocyEntity,
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
    warn: mockState.logWarn,
  },
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

import { POST } from '../products/orphans/route';

describe('mapping wizard orphan product route', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.grocyProducts = [];
    mockState.mealieFoods = [];
    mockState.deleteGrocyEntity.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
    mockState.logWarn.mockClear();
  });

  it('records manual history when orphan Grocy products are deleted', async () => {
    mockState.grocyProducts = [
      { id: 1, name: 'Orphan product' },
      { id: 2, name: 'Mapped product' },
    ];
    mockState.mealieFoods = [{ id: 'food-1', name: 'Milk' }];
    mockState.productMappingsRows = [{ grocyProductId: 2 }];
    mockState.deleteGrocyEntity.mockResolvedValue(undefined);

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/orphans', {
      method: 'POST',
      body: JSON.stringify({
        confirm: true,
        ids: ['1'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 1, total: 1 });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_product_delete_orphans',
      status: 'success',
    }));
  });
});
