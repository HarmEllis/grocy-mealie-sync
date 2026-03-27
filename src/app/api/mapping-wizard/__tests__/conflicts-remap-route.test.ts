import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: {
    id: 'product_mappings.id',
  },
  unitMappingsTable: {
    id: 'unit_mappings.id',
  },
  productMappingsRows: [] as Array<Record<string, any>>,
  unitMappingsRows: [] as Array<Record<string, any>>,
  mealieFoods: [] as Array<Record<string, any>>,
  mealieUnits: [] as Array<Record<string, any>>,
  grocyProducts: [] as Array<Record<string, any>>,
  grocyUnits: [] as Array<Record<string, any>>,
  updateCalls: [] as Array<Record<string, any>>,
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  updateGrocyEntity: vi.fn().mockResolvedValue(undefined),
  resolveConflictsForMapping: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ left, right }),
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
          return mockState.productMappingsRows;
        }

        if (table === mockState.unitMappingsTable) {
          return mockState.unitMappingsRows;
        }

        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, any>) => ({
        where: vi.fn(async (clause: { right: string }) => {
          mockState.updateCalls.push({ table, values, clause });

          if (table === mockState.productMappingsTable) {
            const row = mockState.productMappingsRows.find(mapping => mapping.id === clause.right);
            if (row) {
              Object.assign(row, values);
            }
          }

          if (table === mockState.unitMappingsTable) {
            const row = mockState.unitMappingsRows.find(mapping => mapping.id === clause.right);
            if (row) {
              Object.assign(row, values);
            }
          }
        }),
      })),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'products') {
      return mockState.grocyProducts;
    }

    if (entity === 'quantity_units') {
      return mockState.grocyUnits;
    }

    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
  updateGrocyEntity: mockState.updateGrocyEntity,
}));

vi.mock('@/lib/mealie', () => ({
  RecipesFoodsService: {
    getAllApiFoodsGet: vi.fn(async () => ({ items: mockState.mealieFoods })),
  },
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(async () => ({ items: mockState.mealieUnits })),
  },
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
  },
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

vi.mock('@/lib/mapping-conflicts-store', () => ({
  resolveConflictsForMapping: mockState.resolveConflictsForMapping,
}));

import { GET, POST } from '../conflicts/remap/route';

describe('mapping wizard conflict remap route', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.unitMappingsRows = [];
    mockState.mealieFoods = [];
    mockState.mealieUnits = [];
    mockState.grocyProducts = [];
    mockState.grocyUnits = [];
    mockState.updateCalls = [];

    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.updateGrocyEntity.mockClear();
    mockState.resolveConflictsForMapping.mockClear();
    mockState.logError.mockClear();
  });

  it('returns remap options for a product conflict with current selections', async () => {
    mockState.productMappingsRows = [
      {
        id: 'product-map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Cherry tomaten',
        grocyProductId: 9,
        grocyProductName: 'Cherry tomaten',
        unitMappingId: 'unit-map-1',
      },
    ];
    mockState.unitMappingsRows = [
      {
        id: 'unit-map-1',
        mealieUnitId: 'unit-1',
        mealieUnitName: 'Zak',
        mealieUnitAbbreviation: 'zak',
        grocyUnitId: 3,
        grocyUnitName: 'Zak',
      },
    ];
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Cherry tomaten' },
      { id: 'food-2', name: 'Tomaten' },
    ];
    mockState.grocyProducts = [
      { id: 10, name: 'Cherry tomaten nieuw', qu_id_purchase: 3, min_stock_amount: 0 },
      { id: 11, name: 'Tomaten', qu_id_purchase: 4, min_stock_amount: 0 },
    ];
    mockState.grocyUnits = [
      { id: 3, name: 'Zak' },
      { id: 4, name: 'Bakje' },
    ];

    const response = await GET(new Request(
      'http://localhost/api/mapping-wizard/conflicts/remap?mappingKind=product&mappingId=product-map-1',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      mappingKind: 'product',
      currentSelection: {
        mealieFoodId: 'food-1',
        grocyProductId: 9,
        grocyUnitId: 3,
      },
      mealieFoods: [
        { id: 'food-1', name: 'Cherry tomaten' },
        { id: 'food-2', name: 'Tomaten' },
      ],
      grocyProducts: [
        { id: 10, name: 'Cherry tomaten nieuw', quIdPurchase: 3, minStockAmount: 0 },
        { id: 11, name: 'Tomaten', quIdPurchase: 4, minStockAmount: 0 },
      ],
      grocyUnits: [
        { id: 3, name: 'Zak' },
        { id: 4, name: 'Bakje' },
      ],
    });
  });

  it('remaps an existing product mapping without requiring an unmap first', async () => {
    mockState.productMappingsRows = [
      {
        id: 'product-map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Cherry tomaten',
        grocyProductId: 9,
        grocyProductName: 'Cherry tomaten oud',
        unitMappingId: 'unit-map-1',
        updatedAt: new Date('2026-03-27T20:00:00.000Z'),
      },
      {
        id: 'product-map-2',
        mealieFoodId: 'food-2',
        mealieFoodName: 'Komkommer',
        grocyProductId: 12,
        grocyProductName: 'Komkommer',
        unitMappingId: null,
        updatedAt: new Date('2026-03-27T20:00:00.000Z'),
      },
    ];
    mockState.unitMappingsRows = [
      {
        id: 'unit-map-1',
        mealieUnitId: 'unit-1',
        mealieUnitName: 'Zak',
        mealieUnitAbbreviation: 'zak',
        grocyUnitId: 3,
        grocyUnitName: 'Zak',
      },
    ];
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Cherry tomaten' },
      { id: 'food-2', name: 'Komkommer' },
    ];
    mockState.grocyProducts = [
      { id: 10, name: 'Cherry tomaten nieuw', qu_id_purchase: 3, min_stock_amount: 0 },
      { id: 12, name: 'Komkommer', qu_id_purchase: 5, min_stock_amount: 0 },
    ];
    mockState.grocyUnits = [
      { id: 3, name: 'Zak' },
      { id: 5, name: 'Stuk' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/conflicts/remap', {
      method: 'POST',
      body: JSON.stringify({
        mappingKind: 'product',
        mappingId: 'product-map-1',
        mealieFoodId: 'food-1',
        grocyProductId: 10,
        grocyUnitId: 3,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      mappingKind: 'product',
      mappingId: 'product-map-1',
    });
    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('products', 10, {
      name: 'Cherry tomaten',
    });
    expect(mockState.resolveConflictsForMapping).toHaveBeenCalledWith('product', 'product-map-1');
    expect(mockState.productMappingsRows[0]).toEqual(expect.objectContaining({
      mealieFoodId: 'food-1',
      mealieFoodName: 'Cherry tomaten',
      grocyProductId: 10,
      grocyProductName: 'Cherry tomaten',
      unitMappingId: 'unit-map-1',
      updatedAt: expect.any(Date),
    }));
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('remaps an existing unit mapping and refreshes names', async () => {
    mockState.unitMappingsRows = [
      {
        id: 'unit-map-1',
        mealieUnitId: 'unit-1',
        mealieUnitName: 'Zak',
        mealieUnitAbbreviation: 'zak',
        grocyUnitId: 3,
        grocyUnitName: 'Zak oud',
        updatedAt: new Date('2026-03-27T20:00:00.000Z'),
      },
    ];
    mockState.mealieUnits = [
      { id: 'unit-2', name: 'Bakje', abbreviation: 'bak', pluralName: 'Bakjes' },
    ];
    mockState.grocyUnits = [
      { id: 8, name: 'Bak' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/conflicts/remap', {
      method: 'POST',
      body: JSON.stringify({
        mappingKind: 'unit',
        mappingId: 'unit-map-1',
        mealieUnitId: 'unit-2',
        grocyUnitId: 8,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      mappingKind: 'unit',
      mappingId: 'unit-map-1',
    });
    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('quantity_units', 8, {
      name: 'Bakje',
      name_plural: 'Bakjes',
    });
    expect(mockState.resolveConflictsForMapping).toHaveBeenCalledWith('unit', 'unit-map-1');
    expect(mockState.unitMappingsRows[0]).toEqual(expect.objectContaining({
      mealieUnitId: 'unit-2',
      mealieUnitName: 'Bakje',
      mealieUnitAbbreviation: 'bak',
      grocyUnitId: 8,
      grocyUnitName: 'Bak',
      updatedAt: expect.any(Date),
    }));
  });
});
