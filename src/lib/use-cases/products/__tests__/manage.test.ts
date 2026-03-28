import { describe, expect, it, vi } from 'vitest';
import type { ProductOverview } from '../catalog';
import {
  createProductInGrocy,
  createProductInMealie,
  createProductInBoth,
  updateBasicProduct,
  updateGrocyStockSettings,
} from '../manage';

const mappedOverview: ProductOverview = {
  productRef: 'mapping:map-1',
  mapping: {
    id: 'map-1',
    mealieFoodId: 'food-1',
    mealieFoodName: 'Milk',
    grocyProductId: 101,
    grocyProductName: 'Milk',
    unitMappingId: 'unit-map-1',
  },
  grocyProduct: {
    id: 101,
    name: 'Milk',
    quIdPurchase: 10,
    quIdStock: 10,
    minStockAmount: 2,
    currentStock: 5,
    isBelowMinimum: false,
    treatOpenedAsOutOfStock: false,
    defaultBestBeforeDays: 7,
    defaultBestBeforeDaysAfterOpen: 3,
    shouldNotBeFrozen: false,
  },
  mealieFood: {
    id: 'food-1',
    name: 'Milk',
    pluralName: 'Milks',
    aliases: ['Whole milk'],
  },
};

describe('product management use-cases', () => {
  it('updates Grocy stock settings from MCP-safe fields', async () => {
    const updateGrocyProduct = vi.fn(async () => undefined);

    const result = await updateGrocyStockSettings(
      {
        productRef: 'mapping:map-1',
        minStockAmount: 4,
        treatOpenedAsOutOfStock: true,
        defaultBestBeforeDays: 10,
        defaultBestBeforeDaysAfterOpen: 2,
        allowFreezing: false,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => mappedOverview),
        updateGrocyProduct,
      },
    );

    expect(updateGrocyProduct).toHaveBeenCalledWith(101, {
      min_stock_amount: 4,
      treat_opened_as_out_of_stock: 1,
      default_best_before_days: 10,
      default_best_before_days_after_open: 2,
      should_not_be_frozen: 1,
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      updated: {
        minStockAmount: 4,
        treatOpenedAsOutOfStock: true,
        defaultBestBeforeDays: 10,
        defaultBestBeforeDaysAfterOpen: 2,
        allowFreezing: false,
      },
    });
  });

  it('rejects unsupported freezer shelf-life and due-date semantics fields', async () => {
    await expect(updateGrocyStockSettings(
      {
        productRef: 'mapping:map-1',
        frozenShelfLifeDays: 30,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => mappedOverview),
        updateGrocyProduct: vi.fn(),
      },
    )).rejects.toThrow('The current Grocy API does not expose frozen shelf-life days or due-date semantics fields.');
  });

  it('creates a new product in Grocy and Mealie and stores the mapping', async () => {
    const createGrocyProduct = vi.fn(async () => ({ createdObjectId: 201 }));
    const createMealieFood = vi.fn(async () => ({ id: 'food-201', name: 'Pasta' }));
    const insertProductMapping = vi.fn(async () => undefined);

    const result = await createProductInBoth(
      {
        name: 'Pasta',
        grocyUnitId: 10,
        minStockAmount: 1,
        mealiePluralName: 'Pastas',
        mealieAliases: ['Spaghetti'],
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        checkProductDuplicates: vi.fn(async () => ({
          query: 'Pasta',
          likelyDuplicates: false,
          exactGrocyMatches: [],
          exactMealieMatches: [],
          fuzzyGrocyMatches: [],
          fuzzyMealieMatches: [],
        })),
        listGrocyLocations: vi.fn(async () => [{ id: 1, name: 'Pantry' }]),
        listUnitMappings: vi.fn(async () => [{ id: 'unit-map-1', grocyUnitId: 10 }]),
        createGrocyProduct,
        createMealieFood,
        deleteGrocyProduct: vi.fn(async () => undefined),
        deleteMealieFood: vi.fn(async () => undefined),
        insertProductMapping,
      },
    );

    expect(createGrocyProduct).toHaveBeenCalledWith({
      name: 'Pasta',
      min_stock_amount: 1,
      qu_id_purchase: 10,
      qu_id_stock: 10,
      location_id: 1,
    });
    expect(createMealieFood).toHaveBeenCalledWith({
      name: 'Pasta',
      pluralName: 'Pastas',
      aliases: [{ name: 'Spaghetti' }],
    });
    expect(insertProductMapping).toHaveBeenCalledWith(expect.objectContaining({
      mealieFoodId: 'food-201',
      grocyProductId: 201,
      unitMappingId: 'unit-map-1',
    }));
    expect(result).toEqual({
      created: true,
      grocyProductId: 201,
      grocyProductName: 'Pasta',
      mealieFoodId: 'food-201',
      mealieFoodName: 'Pasta',
      unitMappingId: 'unit-map-1',
      duplicateCheck: {
        skipped: false,
        exactGrocyMatches: 0,
        exactMealieMatches: 0,
      },
    });
  });

  it('rolls back the Grocy product when the Mealie create step fails', async () => {
    const deleteGrocyProduct = vi.fn(async () => undefined);

    await expect(createProductInBoth(
      {
        name: 'Pasta',
        grocyUnitId: 10,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        checkProductDuplicates: vi.fn(async () => ({
          query: 'Pasta',
          likelyDuplicates: false,
          exactGrocyMatches: [],
          exactMealieMatches: [],
          fuzzyGrocyMatches: [],
          fuzzyMealieMatches: [],
        })),
        listGrocyLocations: vi.fn(async () => [{ id: 1, name: 'Pantry' }]),
        listUnitMappings: vi.fn(async () => []),
        createGrocyProduct: vi.fn(async () => ({ createdObjectId: 201 })),
        createMealieFood: vi.fn(async () => {
          throw new Error('Mealie failed');
        }),
        deleteGrocyProduct,
        deleteMealieFood: vi.fn(async () => undefined),
        insertProductMapping: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Mealie failed');

    expect(deleteGrocyProduct).toHaveBeenCalledWith(201);
  });

  it('creates a new Grocy-only product when no exact Grocy duplicate exists', async () => {
    const result = await createProductInGrocy(
      {
        name: 'Beans',
        grocyUnitId: 10,
        minStockAmount: 2,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        checkProductDuplicates: vi.fn(async () => ({
          query: 'Beans',
          likelyDuplicates: false,
          exactGrocyMatches: [],
          exactMealieMatches: [{ id: 'food-9', name: 'Beans', productRef: 'mealie:food-9', source: 'mealie' as const, score: 100, mappingId: null, mapped: false }],
          fuzzyGrocyMatches: [],
          fuzzyMealieMatches: [],
        })),
        listGrocyLocations: vi.fn(async () => [{ id: 1, name: 'Pantry' }]),
        createGrocyProduct: vi.fn(async () => ({ createdObjectId: 222 })),
      },
    );

    expect(result).toEqual({
      created: true,
      grocyProductId: 222,
      grocyProductName: 'Beans',
      duplicateCheck: {
        skipped: false,
        exactGrocyMatches: 0,
      },
    });
  });

  it('creates a new Mealie-only product when no exact Mealie duplicate exists', async () => {
    const result = await createProductInMealie(
      {
        name: 'Oats',
        pluralName: 'Oats',
        aliases: ['Rolled oats'],
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        checkProductDuplicates: vi.fn(async () => ({
          query: 'Oats',
          likelyDuplicates: false,
          exactGrocyMatches: [],
          exactMealieMatches: [],
          fuzzyGrocyMatches: [],
          fuzzyMealieMatches: [],
        })),
        createMealieFood: vi.fn(async () => ({ id: 'food-222', name: 'Oats' })),
      },
    );

    expect(result).toEqual({
      created: true,
      mealieFoodId: 'food-222',
      mealieFoodName: 'Oats',
      duplicateCheck: {
        skipped: false,
        exactMealieMatches: 0,
      },
    });
  });

  it('updates Grocy and Mealie basic product metadata in one operation', async () => {
    const updateGrocyProduct = vi.fn(async () => undefined);
    const updateMealieFood = vi.fn(async () => undefined);

    const result = await updateBasicProduct(
      {
        productRef: 'mapping:map-1',
        grocyName: 'Semi-skimmed milk',
        mealieName: 'Semi Skimmed Milk',
        mealiePluralName: 'Semi Skimmed Milks',
        mealieAliases: ['Milk'],
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => mappedOverview),
        getMealieFood: vi.fn(async () => ({
          id: 'food-1',
          name: 'Milk',
          pluralName: 'Milks',
          description: 'Fresh dairy',
          extras: { source: 'seeded' },
          labelId: 'label-1',
          aliases: [],
        })),
        updateGrocyProduct,
        updateMealieFood,
      },
    );

    expect(updateGrocyProduct).toHaveBeenCalledWith(101, {
      name: 'Semi-skimmed milk',
    });
    expect(updateMealieFood).toHaveBeenCalledWith('food-1', {
      id: 'food-1',
      name: 'Semi Skimmed Milk',
      pluralName: 'Semi Skimmed Milks',
      description: 'Fresh dairy',
      extras: { source: 'seeded' },
      labelId: 'label-1',
      aliases: [{ name: 'Milk' }],
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      mealieFoodId: 'food-1',
      updated: {
        grocyName: 'Semi-skimmed milk',
        mealieName: 'Semi Skimmed Milk',
        mealiePluralName: 'Semi Skimmed Milks',
        mealieAliases: ['Milk'],
      },
    });
  });
});
