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
  currentStock: [] as Array<Record<string, unknown>>,
  volatileStock: { missing_products: [] as Array<Record<string, unknown>> },
  resolveMappingWizardMinStockStep: vi.fn(async () => '1'),
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
  getCurrentStock: vi.fn(async () => mockState.currentStock),
  getVolatileStock: vi.fn(async () => mockState.volatileStock),
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

vi.mock('@/lib/settings', () => ({
  resolveMappingWizardMinStockStep: mockState.resolveMappingWizardMinStockStep,
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
    mockState.currentStock = [];
    mockState.volatileStock = { missing_products: [] };
    mockState.resolveMappingWizardMinStockStep.mockReset();
    mockState.resolveMappingWizardMinStockStep.mockResolvedValue('1');
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
    mockState.currentStock = [
      { product_id: 103, amount: 2, amount_aggregated: 2 },
      { product_id: 105, amount: 1, amount_aggregated: 1 },
    ];
    mockState.volatileStock = {
      missing_products: [
        { id: 102 },
        { id: 103 },
      ],
    };
    mockState.grocyProducts.push(
      { id: 105, name: 'Chocolate', qu_id_purchase: 11, min_stock_amount: 1 },
    );

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unmappedGrocyMinStockProducts).toEqual([
      { id: 102, name: 'Eggs', quIdPurchase: 11, minStockAmount: 12, currentStock: 0, isBelowMinimum: true },
      { id: 103, name: 'Butter', quIdPurchase: 10, minStockAmount: 5, currentStock: 2, isBelowMinimum: true },
      { id: 105, name: 'Chocolate', quIdPurchase: 11, minStockAmount: 1, currentStock: 1, isBelowMinimum: false },
    ]);
    expect(body.lowStockGrocyProductSuggestions).toEqual({
      '103': {
        mealieFoodId: 'food-2',
        mealieFoodName: 'Butter',
        score: 100,
        ambiguous: false,
        runnerUp: null,
      },
    });
  });

  it('marks products as below minimum based on Grocy volatile stock, even when current stock equals the minimum', async () => {
    mockState.grocyProducts = [
      { id: 66, name: 'Pandan rijst', qu_id_purchase: 10, min_stock_amount: 1 },
    ];
    mockState.grocyUnits = [
      { id: 10, name: 'Bag' },
    ];
    mockState.currentStock = [
      { product_id: 66, amount: 1, amount_aggregated: 1 },
    ];
    mockState.volatileStock = {
      missing_products: [
        { id: 66 },
      ],
    };

    const response = await GET(createRequest('http://localhost/api/mapping-wizard/data?tab=grocy-min-stock'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unmappedGrocyMinStockProducts).toEqual([
      { id: 66, name: 'Pandan rijst', quIdPurchase: 10, minStockAmount: 1, currentStock: 1, isBelowMinimum: true },
    ]);
    expect(body.minStockStep).toBe('1');
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
      {
        id: 'unit-map-1',
        mealieUnitId: 'unit-1',
        mealieUnitAbbreviation: 'pc',
        grocyUnitId: 10,
        grocyUnitName: 'Piece',
        mealieUnitName: 'Piece',
      },
    ];

    const response = await GET(createRequest('http://localhost/api/mapping-wizard/data?tab=units'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      mealieUnits: [
        { id: 'unit-1', name: 'Piece', abbreviation: 'pc' },
        { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
      ],
      unmappedMealieUnits: [
        { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
      ],
      grocyUnits: [
        { id: 10, name: 'Piece' },
        { id: 11, name: 'Liter' },
      ],
      existingUnitMappings: [
        {
          id: 'unit-map-1',
          mealieUnitId: 'unit-1',
          mealieUnitAbbreviation: 'pc',
          grocyUnitId: 10,
          grocyUnitName: 'Piece',
          mealieUnitName: 'Piece',
        },
      ],
      unitSuggestions: {
        'unit-2': {
          grocyUnitId: 11,
          grocyUnitName: 'Liter',
          score: 100,
          ambiguous: false,
          runnerUp: null,
        },
      },
      orphanGrocyUnitCount: 0,
    });
  });

  it('filters stale unit mappings out of the products tab default-unit data', async () => {
    mockState.mealieUnits = [
      { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
    ];
    mockState.grocyUnits = [
      { id: 20, name: 'Litre' },
    ];
    mockState.unitMappingsRows = [
      {
        id: 'unit-map-stale',
        mealieUnitId: 'unit-removed',
        mealieUnitAbbreviation: 'fl',
        grocyUnitId: 10,
        grocyUnitName: 'Bottle',
        mealieUnitName: 'Fles',
      },
      {
        id: 'unit-map-valid',
        mealieUnitId: 'unit-2',
        mealieUnitAbbreviation: 'l',
        grocyUnitId: 20,
        grocyUnitName: 'Litre',
        mealieUnitName: 'Liter',
      },
    ];

    const response = await GET(createRequest('http://localhost/api/mapping-wizard/data?tab=products'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.existingUnitMappings).toEqual([
      {
        id: 'unit-map-valid',
        mealieUnitId: 'unit-2',
        mealieUnitAbbreviation: 'l',
        grocyUnitId: 20,
        grocyUnitName: 'Litre',
        mealieUnitName: 'Liter',
      },
    ]);
  });

  it('builds unit suggestions from plural names, abbreviations, and aliases', async () => {
    mockState.mealieUnits = [
      {
        id: 'unit-1',
        name: 'Tablespoon',
        pluralName: 'Tablespoons',
        abbreviation: 'tbsp',
        pluralAbbreviation: 'tbsps',
        aliases: [{ name: 'eetlepel' }],
      },
    ];
    mockState.grocyUnits = [
      {
        id: 20,
        name: 'Eetlepel',
        name_plural: 'Eetlepels',
        plural_forms: 'tbsp,tbsps,tablespoon,tablespoons',
      },
    ];

    const response = await GET(createRequest('http://localhost/api/mapping-wizard/data?tab=units'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unitSuggestions).toEqual({
      'unit-1': {
        grocyUnitId: 20,
        grocyUnitName: 'Eetlepel',
        score: 100,
        ambiguous: false,
        runnerUp: null,
      },
    });
  });
});
