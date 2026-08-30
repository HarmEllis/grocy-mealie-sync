import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: { __table: 'product_mappings' },
  unitMappingsTable: { __table: 'unit_mappings' },
  productMappingsRows: [] as Array<Record<string, unknown>>,
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  mealieFoods: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
  createGrocyEntity: vi.fn(),
  getGrocyEntities: vi.fn(),
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
        if (table === mockState.unitMappingsTable) return mockState.unitMappingsRows;
        if (table === mockState.productMappingsTable) return mockState.productMappingsRows;
        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        mockState.insertedValues.push(values);
      }),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: mockState.getGrocyEntities,
  createGrocyEntity: mockState.createGrocyEntity,
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

import { POST } from '../products/create/route';

describe('mapping wizard product create route', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.unitMappingsRows = [];
    mockState.mealieFoods = [];
    mockState.insertedValues = [];
    mockState.createGrocyEntity.mockReset();
    mockState.getGrocyEntities.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('records manual history when Grocy products are created from Mealie foods', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Mapped' },
    ];
    mockState.unitMappingsRows = [{ id: 'unit-map-1', grocyUnitId: 3 }];
    mockState.productMappingsRows = [{ mealieFoodId: 'food-2' }];
    mockState.getGrocyEntities.mockResolvedValue([{ id: 10, name: 'Fridge' }]);
    mockState.createGrocyEntity.mockResolvedValue({ created_object_id: 101 });

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/create', {
      method: 'POST',
      body: JSON.stringify({
        mealieFoodIds: ['food-1', 'food-2'],
        defaultGrocyUnitId: 3,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      created: 1,
      skipped: 1,
      failed: 0,
      items: [
        { id: 'food-1', status: 'created' },
        { id: 'food-2', status: 'skipped' },
      ],
    });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_product_create',
      status: 'success',
    }));
  });

  it('returns 409 with a machine-readable code when the sync lock stays held', async () => {
    mockState.acquireSyncLock.mockReturnValue(false);
    vi.useFakeTimers();

    const pending = POST(new Request('http://localhost/api/mapping-wizard/products/create', {
      method: 'POST',
      body: JSON.stringify({ mealieFoodIds: ['food-1'], defaultGrocyUnitId: 3 }),
    }));

    // The route polls for the lock rather than failing instantly, so the
    // deadline has to elapse before it gives up.
    await vi.advanceTimersByTimeAsync(11_000);
    const response = await pending;
    vi.useRealTimers();
    const body = await response.json();

    expect(response.status).toBe(409);
    // The chunked client retries on this code, never on the message text.
    expect(body.code).toBe('SYNC_LOCKED');
  });

  it('records partial history when one of the Grocy product creations fails', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Yogurt' },
    ];
    mockState.unitMappingsRows = [{ id: 'unit-map-1', grocyUnitId: 3 }];
    mockState.getGrocyEntities.mockResolvedValue([{ id: 10, name: 'Fridge' }]);
    mockState.createGrocyEntity
      .mockResolvedValueOnce({ created_object_id: 101 })
      .mockRejectedValueOnce(new Error('Grocy unavailable'));

    const response = await POST(new Request('http://localhost/api/mapping-wizard/products/create', {
      method: 'POST',
      body: JSON.stringify({
        mealieFoodIds: ['food-1', 'food-2'],
        defaultGrocyUnitId: 3,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // `failed` used to be counted server-side and then dropped from the
    // response, so the UI reported "Created 1 products" for a partial failure.
    expect(body).toEqual({
      created: 1,
      skipped: 0,
      failed: 1,
      items: [
        { id: 'food-1', status: 'created' },
        { id: 'food-2', status: 'failed', error: 'Grocy unavailable' },
      ],
    });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_product_create',
      status: 'partial',
      summary: expect.objectContaining({
        created: 1,
        skipped: 0,
        failed: 1,
      }),
    }));
  });
});
