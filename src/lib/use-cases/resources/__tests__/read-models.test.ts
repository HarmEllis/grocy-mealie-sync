import { describe, expect, it } from 'vitest';
import {
  getStatusResource,
  listUnmappedProductsResource,
  listUnmappedUnitsResource,
  type ResourceReadModelDeps,
} from '../read-models';

function createDeps(overrides: Partial<ResourceReadModelDeps> = {}): ResourceReadModelDeps {
  return {
    getSyncState: async () => ({
      lastGrocyPoll: new Date('2026-03-28T18:00:00.000Z'),
      lastMealiePoll: new Date('2026-03-28T18:05:00.000Z'),
      grocyBelowMinStock: { 101: 1, 202: 1 },
      mealieCheckedItems: { 'item-1': true, 'item-2': true },
      mealieInPossessionByGrocyProduct: {},
      syncRestockedProducts: {},
    }),
    listProductMappings: async () => [
      {
        id: 'map-1',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Whole Milk',
        grocyProductId: 101,
        grocyProductName: 'Milk',
        unitMappingId: 'unit-map-1',
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        updatedAt: new Date('2026-03-28T10:05:00.000Z'),
      },
    ],
    listUnitMappings: async () => [
      {
        id: 'unit-map-1',
        mealieUnitId: 'unit-1',
        mealieUnitName: 'Liter',
        mealieUnitAbbreviation: 'l',
        grocyUnitId: 10,
        grocyUnitName: 'Litre',
        conversionFactor: 1,
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        updatedAt: new Date('2026-03-28T10:05:00.000Z'),
      },
    ],
    listGrocyProducts: async () => [
      {
        id: 101,
        name: 'Milk',
        qu_id_purchase: 10,
        min_stock_amount: 2,
      },
      {
        id: 202,
        name: 'Yoghurt',
        qu_id_purchase: 10,
        min_stock_amount: 1,
      },
    ],
    listGrocyUnits: async () => [
      { id: 10, name: 'Litre' },
      { id: 20, name: 'Pack' },
    ],
    listMealieFoods: async () => [
      { id: 'food-1', name: 'Whole Milk' },
      { id: 'food-2', name: 'Greek Yogurt' },
    ],
    listMealieUnits: async () => [
      { id: 'unit-1', name: 'Liter', abbreviation: 'l' },
      { id: 'unit-2', name: 'Packet', abbreviation: 'pkt' },
    ],
    getCurrentStock: async () => [
      { product_id: 101, amount_aggregated: 3 },
      { product_id: 202, amount_aggregated: 1 },
    ],
    getVolatileStock: async () => ({
      missing_products: [{
        id: 202,
        name: 'Yoghurt',
        amount_missing: 1,
        is_partly_in_stock: 1,
      }],
    }),
    ...overrides,
  };
}

describe('resource read models', () => {
  it('builds the high-level status resource from sync state and mapping counts', async () => {
    const result = await getStatusResource(createDeps());

    expect(result).toEqual({
      lastGrocyPoll: new Date('2026-03-28T18:00:00.000Z'),
      lastMealiePoll: new Date('2026-03-28T18:05:00.000Z'),
      grocyBelowMinStockCount: 2,
      mealieTrackedItemsCount: 2,
      productMappings: 1,
      unitMappings: 1,
    });
  });

  it('returns only unmapped products from both systems with stock context', async () => {
    const result = await listUnmappedProductsResource(createDeps());

    expect(result).toEqual({
      counts: {
        grocyProducts: 1,
        mealieFoods: 1,
      },
      grocyProducts: [
        {
          id: 202,
          name: 'Yoghurt',
          quIdPurchase: 10,
          minStockAmount: 1,
          currentStock: 1,
          isBelowMinimum: true,
        },
      ],
      mealieFoods: [
        {
          id: 'food-2',
          name: 'Greek Yogurt',
        },
      ],
    });
  });

  it('returns only unmapped units from both systems', async () => {
    const result = await listUnmappedUnitsResource(createDeps());

    expect(result).toEqual({
      counts: {
        grocyUnits: 1,
        mealieUnits: 1,
      },
      grocyUnits: [
        {
          id: 20,
          name: 'Pack',
        },
      ],
      mealieUnits: [
        {
          id: 'unit-2',
          name: 'Packet',
          abbreviation: 'pkt',
        },
      ],
    });
  });
});
