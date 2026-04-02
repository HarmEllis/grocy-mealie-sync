import { describe, expect, it, vi } from 'vitest';
import type { ProductDetailsResponse } from '@/lib/grocy/types';
import type { ProductOverview } from '@/lib/use-cases/products/catalog';
import {
  addStock,
  consumeStock,
  getInventoryStock,
  markStockOpened,
  setStock,
} from '../manage';

const baseOverview: ProductOverview = {
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
  },
  mealieFood: {
    id: 'food-1',
    name: 'Milk',
    pluralName: 'Milks',
    aliases: ['Whole milk'],
  },
  conversions: [],
};

const baseDetails: ProductDetailsResponse = {
  stock_amount: 5,
  stock_amount_opened: 2,
  next_due_date: '2026-03-31',
};

describe('inventory use-cases', () => {
  it('returns a detailed stock snapshot for a product reference', async () => {
    const result = await getInventoryStock(
      { productRef: 'mapping:map-1' },
      {
        getProductOverview: vi.fn(async () => baseOverview),
        getProductDetails: vi.fn(async () => baseDetails),
      },
    );

    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      currentStock: 5,
      openedStock: 2,
      unopenedStock: 3,
      minStockAmount: 2,
      isBelowMinimum: false,
      treatOpenedAsOutOfStock: true,
      nextDueDate: '2026-03-31',
      defaultBestBeforeDays: 7,
      defaultBestBeforeDaysAfterOpen: 3,
      defaultBestBeforeDaysAfterFreezing: 14,
      defaultBestBeforeDaysAfterThawing: 2,
      dueType: 'expiration',
      shouldNotBeFrozen: false,
    });
  });

  it('adds stock with best-before date and note', async () => {
    const addProductStock = vi.fn(async () => undefined);
    const openProductStock = vi.fn(async () => undefined);

    const result = await addStock(
      {
        productRef: 'mapping:map-1',
        amount: 2,
        openedAmount: 1,
        bestBeforeDate: '2026-04-05',
        note: 'Weekly groceries',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        addProductStock,
        openProductStock,
      },
    );

    expect(addProductStock).toHaveBeenCalledWith(101, {
      amount: 2,
      bestBeforeDate: '2026-04-05',
      note: 'Weekly groceries',
    });
    expect(openProductStock).toHaveBeenCalledWith(101, {
      amount: 1,
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      amount: 2,
      openedAmount: 1,
      bestBeforeDate: '2026-04-05',
      note: 'Weekly groceries',
    });
  });

  it('consumes stock for a product', async () => {
    const consumeProductStock = vi.fn(async () => undefined);

    const result = await consumeStock(
      {
        productRef: 'mapping:map-1',
        amount: 1.5,
        spoiled: true,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        consumeProductStock,
      },
    );

    expect(consumeProductStock).toHaveBeenCalledWith(101, {
      amount: 1.5,
      spoiled: true,
      exactAmount: false,
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      amount: 1.5,
      spoiled: true,
      exactAmount: false,
    });
  });

  it('sets stock to an exact inventory amount', async () => {
    const inventoryProductStock = vi.fn(async () => undefined);
    const getProductDetails = vi
      .fn<() => Promise<ProductDetailsResponse>>()
      .mockResolvedValueOnce({
        stock_amount: 5,
        stock_amount_opened: 1,
      })
      .mockResolvedValueOnce({
        stock_amount: 9,
        stock_amount_opened: 1,
      });
    const openProductStock = vi.fn(async () => undefined);

    const result = await setStock(
      {
        productRef: 'mapping:map-1',
        amount: 9,
        openedAmount: 3,
        bestBeforeDate: '2026-04-10',
        note: 'Pantry count',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductDetails,
        inventoryProductStock,
        openProductStock,
      },
    );

    expect(inventoryProductStock).toHaveBeenCalledWith(101, {
      newAmount: 9,
      bestBeforeDate: '2026-04-10',
      note: 'Pantry count',
    });
    expect(openProductStock).toHaveBeenCalledWith(101, {
      amount: 2,
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      amount: 9,
      openedAmount: 3,
      bestBeforeDate: '2026-04-10',
      note: 'Pantry count',
    });
  });

  it('skips inventory correction when only the opened amount changes', async () => {
    const inventoryProductStock = vi.fn(async () => undefined);
    const getProductDetails = vi.fn(async (): Promise<ProductDetailsResponse> => ({
      stock_amount: 5,
      stock_amount_opened: 1,
    }));
    const openProductStock = vi.fn(async () => undefined);

    const result = await setStock(
      {
        productRef: 'mapping:map-1',
        amount: 5,
        openedAmount: 3,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductDetails,
        inventoryProductStock,
        openProductStock,
      },
    );

    expect(inventoryProductStock).not.toHaveBeenCalled();
    expect(openProductStock).toHaveBeenCalledWith(101, { amount: 2 });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      amount: 5,
      openedAmount: 3,
      bestBeforeDate: null,
      note: null,
    });
  });

  it('rejects impossible opened stock targets before correcting stock', async () => {
    const getProductDetails = vi.fn(async (): Promise<ProductDetailsResponse> => ({
      stock_amount: 5,
      stock_amount_opened: 4,
    }));
    const inventoryProductStock = vi.fn(async () => undefined);
    const openProductStock = vi.fn(async () => undefined);

    await expect(setStock(
      {
        productRef: 'mapping:map-1',
        amount: 4,
        openedAmount: 2,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductDetails,
        inventoryProductStock,
        openProductStock,
      },
    )).rejects.toThrow(
      'Opened amount 2 cannot be reached when setting total stock to 4; at least 3 opened stock would remain.',
    );

    expect(inventoryProductStock).not.toHaveBeenCalled();
    expect(openProductStock).not.toHaveBeenCalled();
  });

  it('marks stock as opened', async () => {
    const openProductStock = vi.fn(async () => undefined);

    const result = await markStockOpened(
      {
        productRef: 'mapping:map-1',
        amount: 2,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        openProductStock,
      },
    );

    expect(openProductStock).toHaveBeenCalledWith(101, { amount: 2 });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      amount: 2,
    });
  });
});
