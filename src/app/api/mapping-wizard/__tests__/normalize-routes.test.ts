import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: {
    __table: 'product_mappings',
    mealieFoodId: 'mealie_food_id',
    grocyProductId: 'grocy_product_id',
  },
  unitMappingsTable: {
    __table: 'unit_mappings',
    mealieUnitId: 'mealie_unit_id',
    grocyUnitId: 'grocy_unit_id',
  },
  productMappingsRows: [] as Array<{ mealieFoodId: string; grocyProductId: number }>,
  unitMappingsRows: [] as Array<{ mealieUnitId: string; grocyUnitId: number }>,
  mealieFoods: [] as Array<Record<string, unknown>>,
  mealieUnits: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  dbUpdateWhere: vi.fn().mockResolvedValue(undefined),
  updateGrocyEntity: vi.fn().mockResolvedValue(undefined),
  updateFood: vi.fn().mockResolvedValue(undefined),
  updateUnit: vi.fn().mockResolvedValue(undefined),
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
          return mockState.productMappingsRows;
        }
        if (table === mockState.unitMappingsTable) {
          return mockState.unitMappingsRows;
        }

        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockState.dbUpdateWhere,
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
    updateOneApiFoodsItemIdPut: mockState.updateFood,
  },
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(async () => ({ items: mockState.mealieUnits })),
    updateOneApiUnitsItemIdPut: mockState.updateUnit,
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

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

import { POST as normalizeProducts } from '../products/normalize/route';
import { POST as normalizeUnits } from '../units/normalize/route';

describe('mapping wizard normalization routes', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.unitMappingsRows = [];
    mockState.mealieFoods = [];
    mockState.mealieUnits = [];
    mockState.grocyProducts = [];
    mockState.grocyUnits = [];

    mockState.dbUpdateWhere.mockClear();
    mockState.updateGrocyEntity.mockClear();
    mockState.updateFood.mockClear();
    mockState.updateUnit.mockClear();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('normalizes products with a complete Mealie payload and only updates mapped Grocy products', async () => {
    mockState.productMappingsRows = [{ mealieFoodId: 'food-1', grocyProductId: 10 }];
    mockState.mealieFoods = [
      {
        id: 'food-1',
        name: 'apple',
        pluralName: 'apples',
        description: 'Crunchy fruit',
        extras: { source: 'seeded' },
        labelId: 'label-1',
        aliases: [{ name: 'malus' }],
        householdsWithIngredientFood: ['house-1'],
      },
      {
        id: 'food-2',
        name: 'Pear',
        pluralName: 'Pears',
      },
    ];
    mockState.grocyProducts = [
      { id: 10, name: 'apple' },
      { id: 99, name: 'banana' },
    ];

    const response = await normalizeProducts();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ normalizedMealie: 1, normalizedGrocy: 1, skippedDuplicates: [] });
    expect(mockState.updateFood).toHaveBeenCalledTimes(1);
    expect(mockState.updateFood).toHaveBeenCalledWith('food-1', {
      id: 'food-1',
      name: 'Apple',
      pluralName: 'Apples',
      description: 'Crunchy fruit',
      extras: { source: 'seeded' },
      labelId: 'label-1',
      aliases: [{ name: 'malus' }],
    });
    expect(mockState.updateGrocyEntity).toHaveBeenCalledTimes(1);
    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('products', 10, { name: 'Apple' });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_product_normalize',
      status: 'success',
    }));
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('normalizes units with a complete Mealie payload and only updates mapped Grocy units', async () => {
    mockState.unitMappingsRows = [{ mealieUnitId: 'unit-1', grocyUnitId: 20 }];
    mockState.mealieUnits = [
      {
        id: 'unit-1',
        name: 'Tablespoon',
        pluralName: 'Tablespoons',
        description: 'Volume unit',
        extras: { system: 'imperial' },
        fraction: true,
        abbreviation: 'TBSP',
        pluralAbbreviation: 'TBSPS',
        useAbbreviation: true,
        aliases: [{ name: 'eetlepel' }],
      },
      {
        id: 'unit-2',
        name: 'gram',
        pluralName: 'grams',
        abbreviation: 'g',
      },
    ];
    mockState.grocyUnits = [
      { id: 20, name: 'Tablespoon', name_plural: 'Tablespoons' },
      { id: 88, name: 'Cup', name_plural: 'Cups' },
    ];

    const response = await normalizeUnits();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ normalizedMealie: 1, normalizedGrocy: 1, skippedDuplicates: [] });
    expect(mockState.updateUnit).toHaveBeenCalledTimes(1);
    expect(mockState.updateUnit).toHaveBeenCalledWith('unit-1', {
      id: 'unit-1',
      name: 'tablespoon',
      pluralName: 'tablespoons',
      description: 'Volume unit',
      extras: { system: 'imperial' },
      fraction: true,
      abbreviation: 'tbsp',
      pluralAbbreviation: 'tbsps',
      useAbbreviation: true,
      aliases: [{ name: 'eetlepel' }],
    });
    expect(mockState.updateGrocyEntity).toHaveBeenCalledTimes(1);
    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('quantity_units', 20, {
      name: 'tablespoon',
      name_plural: 'tablespoons',
    });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_unit_normalize',
      status: 'success',
    }));
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });
});
