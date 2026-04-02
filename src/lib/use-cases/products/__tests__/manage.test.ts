import { describe, expect, it, vi } from 'vitest';
import type { ProductOverview } from '../catalog';
import {
  createProductInGrocy,
  createProductInMealie,
  createProductInBoth,
  updateBasicProduct,
  updateGrocyStockSettings,
  deleteProduct,
  updateProductUnits,
} from '../manage';

const extraGrocyFields = {
  locationId: null,
  locationName: null,
  productGroupId: null,
  productGroupName: null,
} as const;

function grocyProduct(base: Record<string, unknown>) {
  return { ...base, ...extraGrocyFields };
}

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
  grocyProduct: grocyProduct({
    id: 101,
    name: 'Milk',
    quIdPurchase: 10,
    quIdPurchaseName: null,
    quIdStock: 10,
    quIdStockName: null,
    minStockAmount: 2,
    currentStock: 5,
    isBelowMinimum: false,
    treatOpenedAsOutOfStock: false,
    defaultBestBeforeDays: 7,
    defaultBestBeforeDaysAfterOpen: 3,
    defaultBestBeforeDaysAfterFreezing: 14,
    defaultBestBeforeDaysAfterThawing: 2,
    dueType: 'best_before',
    shouldNotBeFrozen: false,
  }) as any,
  mealieFood: {
    id: 'food-1',
    name: 'Milk',
    pluralName: 'Milks',
    aliases: ['Whole milk'],
  },
  conversions: [],
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
        frozenShelfLifeDays: 30,
        thawedShelfLifeDays: 4,
        bestBeforeType: 'expiration',
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
      default_best_before_days_after_freezing: 30,
      default_best_before_days_after_thawing: 4,
      due_type: 2,
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
        frozenShelfLifeDays: 30,
        thawedShelfLifeDays: 4,
        bestBeforeType: 'expiration',
        allowFreezing: false,
      },
    });
  });

  it('creates a new product in Grocy and Mealie and stores the mapping', async () => {
    const createGrocyProduct = vi.fn(async () => ({ createdObjectId: 201 }));
    const createMealieFood = vi.fn(async () => ({ id: 'food-201', name: 'Pasta' }));
    const insertProductMapping = vi.fn(async () => 'map-new');

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
      productRef: 'mapping:map-new',
      grocyProductRef: 'grocy:201',
      mealieProductRef: 'mealie:food-201',
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
        insertProductMapping: vi.fn(async () => 'map-new'),
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
      productRef: 'grocy:222',
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
      productRef: 'mealie:food-222',
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
    }    );
  });

  it('deletes an unmapped Grocy product', async () => {
    const deleteGrocyProduct = vi.fn(async () => undefined);
    const unmappedGrocyOverview: ProductOverview = {
      productRef: 'grocy:999',
      mapping: null,
      grocyProduct: {
        id: 999,
        name: 'Old Product',
        quIdPurchase: 10,
        quIdPurchaseName: null,
        quIdStock: 10,
        quIdStockName: null,
        minStockAmount: 0,
        currentStock: 0,
        isBelowMinimum: false,
        treatOpenedAsOutOfStock: false,
        defaultBestBeforeDays: 7,
        defaultBestBeforeDaysAfterOpen: 3,
        defaultBestBeforeDaysAfterFreezing: 14,
        defaultBestBeforeDaysAfterThawing: 2,
        dueType: 'best_before',
        shouldNotBeFrozen: false,
        ...extraGrocyFields,
      },
      mealieFood: null,
      conversions: [],
    };

    const result = await deleteProduct(
      { productRef: 'grocy:999', system: 'grocy' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => unmappedGrocyOverview),
        listProductMappings: vi.fn(async () => []),
        deleteGrocyProduct,
        deleteMealieFood: vi.fn(async () => undefined),
      },
    );

    expect(deleteGrocyProduct).toHaveBeenCalledWith(999);
    expect(result).toEqual({
      deleted: true,
      system: 'grocy',
      productId: 999,
    });
  });

  it('deletes an unmapped Mealie food', async () => {
    const deleteMealieFood = vi.fn(async () => undefined);
    const unmappedMealieOverview: ProductOverview = {
      productRef: 'mealie:food-999',
      mapping: null,
      grocyProduct: null,
      mealieFood: {
        id: 'food-999',
        name: 'Old Food',
        pluralName: null,
        aliases: [],
      },
      conversions: [],
    };

    const result = await deleteProduct(
      { productRef: 'mealie:food-999', system: 'mealie' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => unmappedMealieOverview),
        listProductMappings: vi.fn(async () => []),
        deleteGrocyProduct: vi.fn(async () => undefined),
        deleteMealieFood,
      },
    );

    expect(deleteMealieFood).toHaveBeenCalledWith('food-999');
    expect(result).toEqual({
      deleted: true,
      system: 'mealie',
      productId: 'food-999',
    });
  });

  it('rejects deleting a mapped Grocy product', async () => {
    const mappingRecord = {
      ...mappedOverview.mapping!,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(deleteProduct(
      { productRef: 'grocy:101', system: 'grocy' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => mappedOverview),
        listProductMappings: vi.fn(async () => [mappingRecord]),
        deleteGrocyProduct: vi.fn(async () => undefined),
        deleteMealieFood: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Cannot delete a mapped product');
  });

  it('rejects deleting a mapped Mealie food', async () => {
    const mappingRecord = {
      ...mappedOverview.mapping!,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(deleteProduct(
      { productRef: 'mealie:food-1', system: 'mealie' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => mappedOverview),
        listProductMappings: vi.fn(async () => [mappingRecord]),
        deleteGrocyProduct: vi.fn(async () => undefined),
        deleteMealieFood: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Cannot delete a mapped product');
  });

  it('rejects deleting a Grocy product that does not exist', async () => {
    const nonExistentOverview: ProductOverview = {
      productRef: 'grocy:999',
      mapping: null,
      grocyProduct: null,
      mealieFood: null,
      conversions: [],
    };

    await expect(deleteProduct(
      { productRef: 'grocy:999', system: 'grocy' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => nonExistentOverview),
        listProductMappings: vi.fn(async () => []),
        deleteGrocyProduct: vi.fn(async () => undefined),
        deleteMealieFood: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Product does not exist in Grocy');
  });

  it('rejects deleting a Mealie food that does not exist', async () => {
    const nonExistentOverview: ProductOverview = {
      productRef: 'mealie:food-999',
      mapping: null,
      grocyProduct: null,
      mealieFood: null,
      conversions: [],
    };

    await expect(deleteProduct(
      { productRef: 'mealie:food-999', system: 'mealie' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => nonExistentOverview),
        listProductMappings: vi.fn(async () => []),
        deleteGrocyProduct: vi.fn(async () => undefined),
        deleteMealieFood: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('Product does not exist in Mealie');
  });

  it('updates Grocy product units', async () => {
    const updateGrocyProduct = vi.fn(async () => undefined);
    const unitsOverview: ProductOverview = {
      productRef: 'grocy:101',
      mapping: null,
      grocyProduct: {
        id: 101,
        name: 'Milk',
        quIdPurchase: 10,
        quIdPurchaseName: null,
        quIdStock: 10,
        quIdStockName: null,
        minStockAmount: 0,
        currentStock: 5,
        isBelowMinimum: false,
        treatOpenedAsOutOfStock: false,
        defaultBestBeforeDays: 7,
        defaultBestBeforeDaysAfterOpen: 3,
        defaultBestBeforeDaysAfterFreezing: 14,
        defaultBestBeforeDaysAfterThawing: 2,
        dueType: 'best_before',
        shouldNotBeFrozen: false,
        ...extraGrocyFields,
      },
      mealieFood: null,
      conversions: [],
    };

    const result = await updateProductUnits(
      { productRef: 'grocy:101', grocyUnitIdPurchase: 20, grocyUnitIdStock: 20 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => unitsOverview),
        updateGrocyProduct,
      },
    );

    expect(updateGrocyProduct).toHaveBeenCalledWith(101, {
      qu_id_purchase: 20,
      qu_id_stock: 20,
    });
    expect(result).toEqual({
      productRef: 'grocy:101',
      grocyProductId: 101,
      updated: {
        quIdPurchase: 20,
        quIdStock: 20,
      },
    });
  });

  it('updates only purchase unit when stock unit is omitted', async () => {
    const updateGrocyProduct = vi.fn(async () => undefined);
    const unitsOverview: ProductOverview = {
      productRef: 'grocy:101',
      mapping: null,
      grocyProduct: {
        id: 101,
        name: 'Milk',
        quIdPurchase: 10,
        quIdPurchaseName: null,
        quIdStock: 10,
        quIdStockName: null,
        minStockAmount: 0,
        currentStock: 5,
        isBelowMinimum: false,
        treatOpenedAsOutOfStock: false,
        defaultBestBeforeDays: 7,
        defaultBestBeforeDaysAfterOpen: 3,
        defaultBestBeforeDaysAfterFreezing: 14,
        defaultBestBeforeDaysAfterThawing: 2,
        dueType: 'best_before',
        shouldNotBeFrozen: false,
        ...extraGrocyFields,
      },
      mealieFood: null,
      conversions: [],
    };

    const result = await updateProductUnits(
      { productRef: 'grocy:101', grocyUnitIdPurchase: 30 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => unitsOverview),
        updateGrocyProduct,
      },
    );

    expect(updateGrocyProduct).toHaveBeenCalledWith(101, {
      qu_id_purchase: 30,
    });
    expect(result.updated).toEqual({
      quIdPurchase: 30,
    });
  });

  it('rejects updating units when no Grocy product exists', async () => {
    const noGrocyOverview: ProductOverview = {
      productRef: 'mealie:food-999',
      mapping: null,
      grocyProduct: null,
      mealieFood: {
        id: 'food-999',
        name: 'Food',
        pluralName: null,
        aliases: [],
      },
      conversions: [],
    };

    await expect(updateProductUnits(
      { productRef: 'mealie:food-999', grocyUnitIdPurchase: 10 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => noGrocyOverview),
        updateGrocyProduct: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('does not exist in Grocy');
  });

  it('rejects updating units when no unit changes are provided', async () => {
    const unitsOverview: ProductOverview = {
      productRef: 'grocy:101',
      mapping: null,
      grocyProduct: {
        id: 101,
        name: 'Milk',
        quIdPurchase: 10,
        quIdPurchaseName: null,
        quIdStock: 10,
        quIdStockName: null,
        minStockAmount: 0,
        currentStock: 5,
        isBelowMinimum: false,
        treatOpenedAsOutOfStock: false,
        defaultBestBeforeDays: 7,
        defaultBestBeforeDaysAfterOpen: 3,
        defaultBestBeforeDaysAfterFreezing: 14,
        defaultBestBeforeDaysAfterThawing: 2,
        dueType: 'best_before',
        shouldNotBeFrozen: false,
        ...extraGrocyFields,
      },
      mealieFood: null,
      conversions: [],
    };

    await expect(updateProductUnits(
      { productRef: 'grocy:101' },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => unitsOverview),
        updateGrocyProduct: vi.fn(async () => undefined),
      },
    )).rejects.toThrow('At least one unit field must be provided');
  });
});
