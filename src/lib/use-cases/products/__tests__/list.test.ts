import { describe, expect, it } from 'vitest';
import {
  listProducts,
  type ProductListDeps,
} from '../list';

function createDeps(overrides: Partial<ProductListDeps> = {}): ProductListDeps {
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
      {
        id: 'map-2',
        mealieFoodId: 'food-2',
        mealieFoodName: 'Butter',
        grocyProductId: 102,
        grocyProductName: 'Butter',
        unitMappingId: 'unit-map-2',
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
        location_id: 1,
        product_group_id: 5,
        no_own_stock: 0,
        should_not_be_frozen: 0,
      },
      {
        id: 102,
        name: 'Butter',
        qu_id_purchase: 10,
        qu_id_stock: 10,
        min_stock_amount: 0,
        location_id: 2,
        product_group_id: 5,
        no_own_stock: 0,
        should_not_be_frozen: 1,
      },
      {
        id: 201,
        name: 'Apple',
        qu_id_purchase: 11,
        qu_id_stock: 11,
        min_stock_amount: 5,
        location_id: 1,
        product_group_id: 3,
        no_own_stock: 0,
        should_not_be_frozen: 0,
      },
      {
        id: 301,
        name: 'Ice Cube Tray',
        qu_id_purchase: 12,
        qu_id_stock: 12,
        min_stock_amount: 0,
        location_id: undefined,
        product_group_id: undefined,
        no_own_stock: 1,
        should_not_be_frozen: 0,
      },
    ],
    getCurrentStock: async () => [
      {
        product_id: 101,
        amount: 1,
        amount_aggregated: 1,
      },
      {
        product_id: 102,
        amount: 3,
        amount_aggregated: 3,
      },
      {
        product_id: 201,
        amount: 2,
        amount_aggregated: 2,
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
        {
          id: 201,
          name: 'Apple',
          amount_missing: 3,
          is_partly_in_stock: 1,
        },
      ],
    }),
    ...overrides,
  };
}

describe('listProducts', () => {
  it('defaults to mapped products only', async () => {
    const result = await listProducts({}, createDeps());

    expect(result.count).toBe(2);
    expect(result.products.map(p => p.grocyProductName)).toEqual(['Butter', 'Milk']);
    expect(result.products.every(p => p.mapped)).toBe(true);
    expect(result.products.every(p => p.productRef.startsWith('mapping:'))).toBe(true);
  });

  it('shows all Grocy products with scope all', async () => {
    const result = await listProducts({ scope: 'all' }, createDeps());

    expect(result.count).toBe(4);
    const refs = result.products.map(p => p.productRef);
    expect(refs).toContain('mapping:map-1');
    expect(refs).toContain('mapping:map-2');
    expect(refs).toContain('grocy:201');
    expect(refs).toContain('grocy:301');
  });

  it('filters by stockGt', async () => {
    const result = await listProducts({ scope: 'all', stockGt: 1 }, createDeps());

    expect(result.count).toBe(2);
    expect(result.products.map(p => p.grocyProductName)).toEqual(['Apple', 'Butter']);
  });

  it('filters by hasMinStock', async () => {
    const result = await listProducts({ scope: 'all', hasMinStock: true }, createDeps());

    expect(result.count).toBe(2);
    expect(result.products.every(p => p.minStockAmount > 0)).toBe(true);
  });

  it('filters by belowMinimum', async () => {
    const result = await listProducts({ scope: 'all', belowMinimum: true }, createDeps());

    expect(result.count).toBe(2);
    expect(result.products.every(p => p.isBelowMinimum)).toBe(true);
  });

  it('filters by locationId', async () => {
    const result = await listProducts({ scope: 'all', locationId: 1 }, createDeps());

    expect(result.count).toBe(2);
    expect(result.products.every(p => p.locationId === 1)).toBe(true);
  });

  it('filters by productGroupId', async () => {
    const result = await listProducts({ scope: 'all', productGroupId: 5 }, createDeps());

    expect(result.count).toBe(2);
    expect(result.products.every(p => p.productGroupId === 5)).toBe(true);
  });

  it('filters by noOwnStock', async () => {
    const result = await listProducts({ scope: 'all', noOwnStock: true }, createDeps());

    expect(result.count).toBe(1);
    expect(result.products[0].grocyProductId).toBe(301);
  });

  it('filters by shouldNotBeFrozen', async () => {
    const result = await listProducts({ scope: 'all', shouldNotBeFrozen: true }, createDeps());

    expect(result.count).toBe(1);
    expect(result.products[0].grocyProductId).toBe(102);
  });

  it('combines multiple filters', async () => {
    const result = await listProducts(
      { scope: 'all', hasMinStock: true, belowMinimum: true },
      createDeps(),
    );

    expect(result.count).toBe(2);
    expect(result.products.every(p => p.minStockAmount > 0 && p.isBelowMinimum)).toBe(true);
  });

  it('sorts products by name', async () => {
    const result = await listProducts({ scope: 'all' }, createDeps());

    const names = result.products.map(p => p.grocyProductName);
    expect(names).toEqual([...names].sort());
  });

  it('includes Mealie info for mapped products', async () => {
    const result = await listProducts({}, createDeps());

    const milk = result.products.find(p => p.grocyProductId === 101);
    expect(milk).toBeDefined();
    expect(milk!.mealieFoodId).toBe('food-1');
    expect(milk!.mealieFoodName).toBe('Whole Milk');
  });

  it('returns null Mealie info for unmapped products', async () => {
    const result = await listProducts({ scope: 'all' }, createDeps());

    const apple = result.products.find(p => p.grocyProductId === 201);
    expect(apple).toBeDefined();
    expect(apple!.mealieFoodId).toBeNull();
    expect(apple!.mealieFoodName).toBeNull();
  });
});
