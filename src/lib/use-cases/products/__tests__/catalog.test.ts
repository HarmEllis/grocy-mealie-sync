import { describe, expect, it } from 'vitest';
import {
  checkProductDuplicates,
  getProductOverview,
  searchProducts,
  type ProductCatalogDeps,
} from '../catalog';

function createDeps(overrides: Partial<ProductCatalogDeps> = {}): ProductCatalogDeps {
  return {
    listProductMappings: async () => [
      {
        id: 'map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        grocyProductId: 101,
        grocyProductName: 'Milk',
        unitMappingId: 'unit-map-1',
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-21T10:00:00.000Z'),
      },
    ],
    listGrocyProducts: async () => [
      {
        id: 101,
        name: 'Milk',
        qu_id_purchase: 10,
        qu_id_stock: 10,
        min_stock_amount: 2,
        treat_opened_as_out_of_stock: 1,
        default_best_before_days: 7,
        default_best_before_days_after_open: 3,
        should_not_be_frozen: 0,
      },
      {
        id: 202,
        name: 'Butter',
        qu_id_purchase: 10,
        qu_id_stock: 10,
        min_stock_amount: 1,
        treat_opened_as_out_of_stock: 0,
        default_best_before_days: 30,
        default_best_before_days_after_open: 10,
        should_not_be_frozen: 1,
      },
    ],
    listMealieFoods: async () => [
      {
        id: 'food-1',
        name: 'Whole Milk',
        pluralName: 'Whole Milks',
        aliases: [{ name: 'Milk' }],
      },
      {
        id: 'food-2',
        name: 'Butter',
        pluralName: 'Butters',
        aliases: [{ name: 'Salted Butter' }],
      },
    ],
    getCurrentStock: async () => [
      {
        product_id: 101,
        amount: 1,
        amount_aggregated: 1,
      },
      {
        product_id: 202,
        amount: 3,
        amount_aggregated: 3,
      },
    ],
    getVolatileStock: async () => ({
      missing_products: [
        {
          id: 101,
          name: 'Milk',
          amount_missing: 1,
          is_partly_in_stock: 1,
        },
      ],
    }),
    ...overrides,
  };
}

describe('product catalog use-cases', () => {
  it('searches across mapped and unmapped products while preferring combined mapped results', async () => {
    const result = await searchProducts(
      { query: 'milk', maxResults: 5 },
      createDeps(),
    );

    expect(result.matches).toEqual([
      {
        productRef: 'mapping:map-1',
        source: 'mapping',
        score: 100,
        label: 'Whole Milk <-> Milk',
        mappingId: 'map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        grocyProductId: 101,
        grocyProductName: 'Milk',
      },
    ]);
  });

  it('builds a combined product overview with mapping and Grocy stock context', async () => {
    const overview = await getProductOverview(
      { productRef: 'mapping:map-1' },
      createDeps(),
    );

    expect(overview).toEqual({
      productRef: 'mapping:map-1',
      mapping: {
        id: 'map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
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
        currentStock: 1,
        isBelowMinimum: true,
        treatOpenedAsOutOfStock: true,
        defaultBestBeforeDays: 7,
        defaultBestBeforeDaysAfterOpen: 3,
        shouldNotBeFrozen: false,
      },
      mealieFood: {
        id: 'food-1',
        name: 'Whole Milk',
        pluralName: 'Whole Milks',
        aliases: ['Milk'],
      },
    });
  });

  it('checks duplicates across Grocy and Mealie with exact and fuzzy matches', async () => {
    const duplicates = await checkProductDuplicates(
      { name: 'Butter' },
      createDeps(),
    );

    expect(duplicates).toEqual({
      query: 'Butter',
      likelyDuplicates: true,
      exactGrocyMatches: [
        {
          productRef: 'grocy:202',
          source: 'grocy',
          score: 100,
          id: 202,
          name: 'Butter',
          mappingId: null,
          mapped: false,
        },
      ],
      exactMealieMatches: [
        {
          productRef: 'mealie:food-2',
          source: 'mealie',
          score: 100,
          id: 'food-2',
          name: 'Butter',
          mappingId: null,
          mapped: false,
        },
      ],
      fuzzyGrocyMatches: [],
      fuzzyMealieMatches: [],
    });
  });
});
