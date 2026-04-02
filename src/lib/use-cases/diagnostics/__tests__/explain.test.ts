import { describe, expect, it, vi } from 'vitest';
import type { ProductOverview } from '@/lib/use-cases/products/catalog';
import { explainProductState } from '../explain';

const mappedOverview: ProductOverview = {
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
    quIdPurchaseName: null,
    quIdStock: 10,
    quIdStockName: null,
    minStockAmount: 2,
    currentStock: 1,
    isBelowMinimum: true,
    treatOpenedAsOutOfStock: true,
    defaultBestBeforeDays: 7,
    defaultBestBeforeDaysAfterOpen: 3,
    defaultBestBeforeDaysAfterFreezing: 14,
    defaultBestBeforeDaysAfterThawing: 2,
    dueType: 'expiration',
    shouldNotBeFrozen: false,
    locationId: null,
    locationName: null,
    productGroupId: null,
    productGroupName: null,
    moveOnOpen: false,
    defaultConsumeLocationId: null,
    defaultConsumeLocationName: null,
  },
  mealieFood: {
    id: 'food-1',
    name: 'Whole Milk',
    pluralName: 'Whole Milks',
    aliases: ['Milk'],
  },
  conversions: [],
};

describe('product diagnostics', () => {
  it('explains a mapped product that is below minimum and has open conflicts', async () => {
    const result = await explainProductState(
      { productRef: 'mapping:map-1' },
      {
        getProductOverview: vi.fn(async () => mappedOverview),
        listOpenMappingConflicts: vi.fn(async () => [
          {
            id: 'conflict-1',
            conflictKey: 'product:food-1:grocy-101',
            type: 'missing-unit-mapping',
            status: 'open',
            severity: 'warning',
            mappingKind: 'product',
            mappingId: 'map-1',
            sourceTab: 'products',
            mealieId: 'food-1',
            mealieName: 'Whole Milk',
            grocyId: 101,
            grocyName: 'Milk',
            summary: 'Product mapping references a missing unit mapping.',
            occurrences: 2,
            firstSeenAt: new Date('2026-03-28T09:00:00.000Z'),
            lastSeenAt: new Date('2026-03-28T10:00:00.000Z'),
            resolvedAt: null,
          },
        ]),
      },
    );

    expect(result).toEqual({
      productRef: 'mapping:map-1',
      summary: 'The product is mapped, currently below minimum stock in Grocy, and has 1 open mapping conflict.',
      mappingStatus: 'mapped',
      stockStatus: {
        currentStock: 1,
        minStockAmount: 2,
        isBelowMinimum: true,
        treatOpenedAsOutOfStock: true,
      },
      openConflicts: [
        {
          id: 'conflict-1',
          summary: 'Product mapping references a missing unit mapping.',
          severity: 'warning',
        },
      ],
      notes: [
        'Grocy currently reports this product below minimum stock.',
        'Opened stock is configured to count as out of stock in Grocy.',
      ],
    });
  });

  it('explains when a product reference is not mapped yet', async () => {
    const result = await explainProductState(
      { productRef: 'mealie:food-9' },
      {
        getProductOverview: vi.fn(async () => ({
          productRef: 'mealie:food-9',
          mapping: null,
          grocyProduct: null,
          mealieFood: {
            id: 'food-9',
            name: 'Pasta',
            pluralName: 'Pastas',
            aliases: [],
          },
          conversions: [],
        })),
        listOpenMappingConflicts: vi.fn(async () => []),
      },
    );

    expect(result).toEqual({
      productRef: 'mealie:food-9',
      summary: 'This product is not mapped yet.',
      mappingStatus: 'unmapped',
      stockStatus: null,
      openConflicts: [],
      notes: [
        'No product mapping exists for this reference yet.',
      ],
    });
  });
});
