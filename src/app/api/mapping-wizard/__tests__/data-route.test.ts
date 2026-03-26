import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: { __table: 'product_mappings' },
  unitMappingsTable: { __table: 'unit_mappings' },
  productMappingsRows: [] as Array<Record<string, unknown>>,
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  mealieFoods: [] as Array<Record<string, unknown>>,
  mealieUnits: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  logError: vi.fn(),
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
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'products') return mockState.grocyProducts;
    if (entity === 'quantity_units') return mockState.grocyUnits;
    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
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

import { GET } from '../data/route';

function createRequest(url = 'http://localhost/api/mapping-wizard/data'): Request {
  return new Request(url);
}

describe('mapping wizard data route', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.unitMappingsRows = [];
    mockState.mealieFoods = [];
    mockState.mealieUnits = [];
    mockState.grocyProducts = [];
    mockState.grocyUnits = [];
    mockState.logError.mockClear();
  });

  it('returns Grocy min-stock products that are still unmapped with reverse suggestions', async () => {
    mockState.mealieFoods = [
      { id: 'food-1', name: 'Milk' },
      { id: 'food-2', name: 'Butter' },
    ];
    mockState.mealieUnits = [
      { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Milk', qu_id_purchase: 10, min_stock_amount: 0 },
      { id: 102, name: 'Eggs', qu_id_purchase: 11, min_stock_amount: 12 },
      { id: 103, name: 'Butter', qu_id_purchase: 10, min_stock_amount: 5 },
      { id: 104, name: 'Mapped Product', qu_id_purchase: 10, min_stock_amount: 2 },
    ];
    mockState.grocyUnits = [
      { id: 10, name: 'Piece' },
      { id: 11, name: 'Box' },
    ];
    mockState.productMappingsRows = [
      { mealieFoodId: 'food-1', grocyProductId: 104 },
    ];
    mockState.unitMappingsRows = [
      { id: 'unit-map-1', grocyUnitId: 10, grocyUnitName: 'Piece', mealieUnitName: 'Piece' },
    ];

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unmappedGrocyMinStockProducts).toEqual([
      { id: 102, name: 'Eggs', quIdPurchase: 11, minStockAmount: 12 },
      { id: 103, name: 'Butter', quIdPurchase: 10, minStockAmount: 5 },
    ]);
    expect(body.lowStockGrocyProductSuggestions).toEqual({
      '103': {
        mealieFoodId: 'food-2',
        mealieFoodName: 'Butter',
        score: 100,
      },
    });
  });

  it('supports tab-specific lazy loading for units', async () => {
    mockState.mealieUnits = [
      { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
      { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
    ];
    mockState.grocyUnits = [
      { id: 10, name: 'Piece' },
      { id: 11, name: 'Liter' },
    ];
    mockState.unitMappingsRows = [
      { id: 'unit-map-1', mealieUnitId: 'unit-1', grocyUnitId: 10, grocyUnitName: 'Piece', mealieUnitName: 'Piece' },
    ];

    const response = await GET(createRequest('http://localhost/api/mapping-wizard/data?tab=units'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      unmappedMealieUnits: [
        { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
      ],
      grocyUnits: [
        { id: 10, name: 'Piece' },
        { id: 11, name: 'Liter' },
      ],
      unitSuggestions: {
        'unit-2': {
          grocyUnitId: 11,
          grocyUnitName: 'Liter',
          score: 100,
        },
      },
      orphanGrocyUnitCount: 0,
    });
  });
});
