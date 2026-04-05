import { describe, expect, it, vi } from 'vitest';
import type { ProductDetailsResponse, StockEntry, StockLogEntry } from '@/lib/grocy/types';
import type { ProductOverview } from '@/lib/use-cases/products/catalog';
import {
  addStock,
  consumeStock,
  createInventoryEntry,
  deleteInventoryEntry,
  getInventoryEntry,
  getInventoryStock,
  listInventoryEntries,
  markStockOpened,
  setStock,
  updateInventoryEntry,
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
    quIdPurchaseName: null,
    quIdStock: 10,
    quIdStockName: null,
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
    moveOnOpen: false,
    defaultConsumeLocationId: null,
    defaultConsumeLocationName: null,
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

const createEntryIdentificationWarning = 'Stock was added in Grocy, but no new individual stock entries could be identified. Grocy may have merged the amount into an existing batch.';

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
    const addProductStock = vi.fn(async (): Promise<StockLogEntry[]> => []);
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

  it('lists stock entries for a product reference', async () => {
    const result = await listInventoryEntries(
      { productRef: 'mapping:map-1' },
      {
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries: vi.fn(async () => [
          {
            id: 2,
            product_id: 101,
            location_id: 1,
            amount: 1,
            best_before_date: '2026-04-10',
            open: 0,
          },
          {
            id: 1,
            product_id: 101,
            location_id: 1,
            amount: 2,
            best_before_date: '2026-04-05',
            open: 1,
          },
        ] as any),
      },
    );

    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 2,
      entries: [
        {
          entryId: 1,
          productId: 101,
          locationId: 1,
          shoppingLocationId: null,
          amount: 2,
          bestBeforeDate: '2026-04-05',
          purchasedDate: null,
          stockId: null,
          price: null,
          open: true,
          openedDate: null,
          note: null,
          rowCreatedTimestamp: null,
        },
        {
          entryId: 2,
          productId: 101,
          locationId: 1,
          shoppingLocationId: null,
          amount: 1,
          bestBeforeDate: '2026-04-10',
          purchasedDate: null,
          stockId: null,
          price: null,
          open: false,
          openedDate: null,
          note: null,
          rowCreatedTimestamp: null,
        },
      ],
    });
  });

  it('returns an empty stock-entry list when a product has no entries', async () => {
    const result = await listInventoryEntries(
      { productRef: 'mapping:map-1' },
      {
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries: vi.fn(async () => []),
      },
    );

    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 0,
      entries: [],
    });
  });

  it('loads one inventory entry by id', async () => {
    const result = await getInventoryEntry(
      { entryId: 12 },
      {
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          location_id: 2,
          shopping_location_id: 3,
          amount: 1.5,
          best_before_date: '2026-04-12',
          purchased_date: '2026-04-01',
          stock_id: 'stock-12',
          price: 4.25,
          open: 1,
          opened_date: '2026-04-02',
          note: 'Top shelf',
          row_created_timestamp: '2026-04-01T10:00:00Z',
        })),
      },
    );

    expect(result).toEqual({
      entry: {
        entryId: 12,
        productId: 101,
        locationId: 2,
        shoppingLocationId: 3,
        amount: 1.5,
        bestBeforeDate: '2026-04-12',
        purchasedDate: '2026-04-01',
        stockId: 'stock-12',
        price: 4.25,
        open: true,
        openedDate: '2026-04-02',
        note: 'Top shelf',
        rowCreatedTimestamp: '2026-04-01T10:00:00Z',
      },
    });
  });

  it('deletes one inventory entry by stock entry id targeting', async () => {
    const consumeProductStockByEntry = vi.fn(async () => undefined);

    const result = await deleteInventoryEntry(
      { entryId: 12 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          location_id: 2,
          amount: 1,
          best_before_date: '2026-04-12',
          purchased_date: '2026-04-01',
          stock_id: 'stock-12',
          open: 0,
        })),
        consumeProductStockByEntry,
      },
    );

    expect(consumeProductStockByEntry).toHaveBeenCalledTimes(1);
    expect(consumeProductStockByEntry).toHaveBeenCalledWith(101, 'stock-12');
    expect(result).toEqual({
      entryId: 12,
      entry: {
        entryId: 12,
        productId: 101,
        locationId: 2,
        shoppingLocationId: null,
        amount: 1,
        bestBeforeDate: '2026-04-12',
        purchasedDate: '2026-04-01',
        stockId: 'stock-12',
        price: null,
        open: false,
        openedDate: null,
        note: null,
        rowCreatedTimestamp: null,
      },
    });
  });

  it('repeats targeted consume for multi-amount inventory entry deletes', async () => {
    const consumeProductStockByEntry = vi.fn(async () => undefined);

    await deleteInventoryEntry(
      { entryId: 12 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          amount: 3,
          stock_id: 'stock-12',
        })),
        consumeProductStockByEntry,
      },
    );

    expect(consumeProductStockByEntry).toHaveBeenCalledTimes(3);
    expect(consumeProductStockByEntry).toHaveBeenNthCalledWith(1, 101, 'stock-12');
    expect(consumeProductStockByEntry).toHaveBeenNthCalledWith(2, 101, 'stock-12');
    expect(consumeProductStockByEntry).toHaveBeenNthCalledWith(3, 101, 'stock-12');
  });

  it('propagates stale inventory entry lookup failures when deleting', async () => {
    const consumeProductStockByEntry = vi.fn(async () => undefined);

    await expect(deleteInventoryEntry(
      { entryId: 999 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getGrocyStockEntry: vi.fn(async () => {
          throw new Error('Invalid stock entry id');
        }),
        consumeProductStockByEntry,
      },
    )).rejects.toThrow('Invalid stock entry id');

    expect(consumeProductStockByEntry).not.toHaveBeenCalled();
  });

  it('rejects deleting inventory entries without stock ids', async () => {
    const consumeProductStockByEntry = vi.fn(async () => undefined);

    await expect(deleteInventoryEntry(
      { entryId: 12 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          amount: 1,
        })),
        consumeProductStockByEntry,
      },
    )).rejects.toThrow('Entry has no stock_id, cannot target for deletion.');

    expect(consumeProductStockByEntry).not.toHaveBeenCalled();
  });

  it('rejects deleting inventory entries with fractional amounts', async () => {
    const consumeProductStockByEntry = vi.fn(async () => undefined);

    await expect(deleteInventoryEntry(
      { entryId: 12 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          amount: 1.5,
          stock_id: 'stock-12',
        })),
        consumeProductStockByEntry,
      },
    )).rejects.toThrow(
      'Cannot delete entry with fractional amount 1.5 - targeted deletion of fractional entries is not supported by the Grocy API.',
    );

    expect(consumeProductStockByEntry).not.toHaveBeenCalled();
  });

  it('creates inventory entries and returns the newly created entry details', async () => {
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-1',
        stock_id: 'stock-8',
      },
    ];
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([
        {
          id: 7,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-7',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 7,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-7',
        },
        {
          id: 8,
          product_id: 101,
          location_id: 2,
          amount: 2,
          best_before_date: '2026-04-15',
          stock_id: 'stock-8',
          note: 'Fresh batch',
          open: 0,
        },
        {
          id: 90,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-foreign',
          best_before_date: '2026-04-30',
          open: 0,
        },
      ]);
    const addProductStock = vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries);
    const getStockTransactionEntries = vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries);
    const updateGrocyStockEntry = vi.fn(async () => undefined);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 2,
        bestBeforeDate: '2026-04-15',
        locationId: 2,
        note: 'Fresh batch',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries,
        getGrocyStockEntry: vi.fn(),
        addProductStock,
        updateGrocyStockEntry,
      },
    );

    expect(addProductStock).toHaveBeenCalledWith(101, {
      amount: 2,
      bestBeforeDate: '2026-04-15',
      locationId: 2,
      note: 'Fresh batch',
    });
    expect(updateGrocyStockEntry).not.toHaveBeenCalled();
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 1,
      entries: [
        {
          entryId: 8,
          productId: 101,
          locationId: 2,
          shoppingLocationId: null,
          amount: 2,
          bestBeforeDate: '2026-04-15',
          purchasedDate: null,
          stockId: 'stock-8',
          price: null,
          open: false,
          openedDate: null,
          note: 'Fresh batch',
          rowCreatedTimestamp: null,
        },
      ],
    });
  });

  it('applies follow-up entry updates after creating inventory entries', async () => {
    const createdEntry: StockEntry = {
      id: 9,
      product_id: 101,
      location_id: 2,
      amount: 1,
      best_before_date: '2026-04-20',
      stock_id: 'stock-9',
      open: 0,
      note: 'Fresh batch',
    };
    const updatedEntry: StockEntry = {
      ...createdEntry,
      purchased_date: '2026-04-03',
      open: 1,
      opened_date: '2026-04-03',
    };
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdEntry]);
    const getGrocyStockEntry = vi.fn(async () => updatedEntry);
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-2',
        stock_id: 'stock-9',
      },
    ];
    const addProductStock = vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries);
    const getStockTransactionEntries = vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries);
    const updateGrocyStockEntry = vi.fn(async () => undefined);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
        bestBeforeDate: '2026-04-20',
        purchasedDate: '2026-04-03',
        open: true,
        locationId: 2,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries,
        getGrocyStockEntry,
        addProductStock,
        updateGrocyStockEntry,
      },
    );

    expect(updateGrocyStockEntry).toHaveBeenCalledWith(9, {
      purchasedDate: '2026-04-03',
      open: true,
    });
    expect(getGrocyStockEntry).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 1,
      entries: [
        {
          entryId: 9,
          productId: 101,
          locationId: 2,
          shoppingLocationId: null,
          amount: 1,
          bestBeforeDate: '2026-04-20',
          purchasedDate: '2026-04-03',
          stockId: 'stock-9',
          price: null,
          open: true,
          openedDate: '2026-04-03',
          note: 'Fresh batch',
          rowCreatedTimestamp: null,
        },
      ],
    });
  });

  it('falls back to the before/after diff when transaction lookup fails after add succeeded', async () => {
    const createdEntry: StockEntry = {
      id: 16,
      product_id: 101,
      location_id: 2,
      amount: 1,
      best_before_date: '2026-04-22',
      stock_id: 'stock-16',
      open: 0,
    };
    const updatedEntry: StockEntry = {
      ...createdEntry,
      purchased_date: '2026-04-04',
      open: 1,
      opened_date: '2026-04-04',
    };
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdEntry]);
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-fallback',
      },
    ];
    const getStockTransactionEntries = vi.fn(async (): Promise<StockLogEntry[]> => {
      throw new Error('Transaction lookup unavailable');
    });
    const updateGrocyStockEntry = vi.fn(async () => undefined);
    const getGrocyStockEntry = vi.fn(async () => updatedEntry);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
        bestBeforeDate: '2026-04-22',
        purchasedDate: '2026-04-04',
        open: true,
        locationId: 2,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries,
        getGrocyStockEntry,
        addProductStock: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        updateGrocyStockEntry,
      },
    );

    expect(getStockTransactionEntries).toHaveBeenCalledWith('tx-fallback');
    expect(updateGrocyStockEntry).toHaveBeenCalledWith(16, {
      purchasedDate: '2026-04-04',
      open: true,
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 1,
      entries: [
        {
          entryId: 16,
          productId: 101,
          locationId: 2,
          shoppingLocationId: null,
          amount: 1,
          bestBeforeDate: '2026-04-22',
          purchasedDate: '2026-04-04',
          stockId: 'stock-16',
          price: null,
          open: true,
          openedDate: '2026-04-04',
          note: null,
          rowCreatedTimestamp: null,
        },
      ],
    });
  });

  it('falls back to the before/after diff when add logs omit transaction ids', async () => {
    const createdEntry: StockEntry = {
      id: 17,
      product_id: 101,
      location_id: 2,
      amount: 1,
      best_before_date: '2026-04-24',
      open: 0,
    };
    const updatedEntry: StockEntry = {
      ...createdEntry,
      purchased_date: '2026-04-05',
      open: 1,
      opened_date: '2026-04-05',
    };
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([
        {
          id: 1,
          product_id: 101,
          amount: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          product_id: 101,
          amount: 1,
        },
        createdEntry,
      ]);
    const addLogEntries: StockLogEntry[] = [{}];
    const getStockTransactionEntries = vi.fn(async (): Promise<StockLogEntry[]> => []);
    const updateGrocyStockEntry = vi.fn(async () => undefined);
    const getGrocyStockEntry = vi.fn(async () => updatedEntry);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
        bestBeforeDate: '2026-04-24',
        purchasedDate: '2026-04-05',
        open: true,
        locationId: 2,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries,
        getGrocyStockEntry,
        addProductStock: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        updateGrocyStockEntry,
      },
    );

    expect(getStockTransactionEntries).not.toHaveBeenCalled();
    expect(updateGrocyStockEntry).toHaveBeenCalledWith(17, {
      purchasedDate: '2026-04-05',
      open: true,
    });
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 1,
      entries: [
        {
          entryId: 17,
          productId: 101,
          locationId: 2,
          shoppingLocationId: null,
          amount: 1,
          bestBeforeDate: '2026-04-24',
          purchasedDate: '2026-04-05',
          stockId: null,
          price: null,
          open: true,
          openedDate: '2026-04-05',
          note: null,
          rowCreatedTimestamp: null,
        },
      ],
    });
  });

  it('returns a warning when transaction matching succeeds but yields no identifiable entries', async () => {
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-3',
      },
    ];
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([
        {
          id: 1,
          product_id: 101,
          amount: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          product_id: 101,
          amount: 1,
        },
        {
          id: 2,
          product_id: 101,
          amount: 1,
          best_before_date: '2026-04-25',
          open: 0,
        },
      ]);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
        bestBeforeDate: '2026-04-25',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        getGrocyStockEntry: vi.fn(),
        addProductStock: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        updateGrocyStockEntry: vi.fn(async () => undefined),
      },
    );

    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 0,
      entries: [],
      warning: createEntryIdentificationWarning,
    });
  });

  it('treats explicit null best-before dates as undated entries after creation', async () => {
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-4',
        stock_id: 'stock-10',
      },
    ];
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 10,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-10',
          best_before_date: '2999-12-31',
          open: 0,
        },
      ]);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
        bestBeforeDate: null,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        getGrocyStockEntry: vi.fn(),
        addProductStock: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        updateGrocyStockEntry: vi.fn(async () => undefined),
      },
    );

    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 1,
      entries: [
        {
          entryId: 10,
          productId: 101,
          locationId: null,
          shoppingLocationId: null,
          amount: 1,
          bestBeforeDate: null,
          purchasedDate: null,
          stockId: 'stock-10',
          price: null,
          open: false,
          openedDate: null,
          note: null,
          rowCreatedTimestamp: null,
        },
      ],
    });
  });

  it('returns a warning instead of diffing when stock is merged and another entry appears', async () => {
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-4b',
        stock_id: 'stock-existing',
      },
    ];
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([
        {
          id: 10,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-existing',
          best_before_date: '2026-04-20',
          open: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          product_id: 101,
          amount: 2,
          stock_id: 'stock-existing',
          best_before_date: '2026-04-20',
          open: 0,
        },
        {
          id: 99,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-foreign',
          best_before_date: '2026-04-25',
          open: 0,
        },
      ]);
    const updateGrocyStockEntry = vi.fn(async () => undefined);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
        purchasedDate: '2026-04-03',
        open: true,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        getGrocyStockEntry: vi.fn(),
        addProductStock: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        updateGrocyStockEntry,
      },
    );

    expect(updateGrocyStockEntry).not.toHaveBeenCalled();
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 0,
      entries: [],
      warning: createEntryIdentificationWarning,
    });
  });

  it('returns a warning when no entries can be identified after transaction lookup failure', async () => {
    const addLogEntries: StockLogEntry[] = [
      {
        transaction_id: 'tx-5',
      },
    ];
    const getProductStockEntries = vi
      .fn<() => Promise<StockEntry[]>>()
      .mockResolvedValueOnce([
        {
          id: 1,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          product_id: 101,
          amount: 1,
          stock_id: 'stock-1',
        },
      ]);

    const updateGrocyStockEntry = vi.fn(async () => undefined);

    const result = await createInventoryEntry(
      {
        productRef: 'mapping:map-1',
        amount: 1,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        getProductOverview: vi.fn(async () => baseOverview),
        getProductStockEntries,
        getStockTransactionEntries: vi.fn(async (): Promise<StockLogEntry[]> => {
          throw new Error('Transaction lookup unavailable');
        }),
        getGrocyStockEntry: vi.fn(),
        addProductStock: vi.fn(async (): Promise<StockLogEntry[]> => addLogEntries),
        updateGrocyStockEntry,
      },
    );

    expect(updateGrocyStockEntry).not.toHaveBeenCalled();
    expect(result).toEqual({
      productRef: 'mapping:map-1',
      grocyProductId: 101,
      name: 'Milk',
      count: 0,
      entries: [],
      warning: createEntryIdentificationWarning,
    });
  });

  it('updates one inventory entry using the explicit editable allowlist', async () => {
    const updateGrocyStockEntry = vi.fn(async () => undefined);

    const result = await updateInventoryEntry(
      {
        entryId: 12,
        amount: 2,
        bestBeforeDate: '2026-04-15',
        price: 4.5,
        open: true,
        locationId: 4,
        shoppingLocationId: 8,
        purchasedDate: '2026-04-03',
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        updateGrocyStockEntry,
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          location_id: 4,
          shopping_location_id: 8,
          amount: 2,
          best_before_date: '2026-04-15',
          purchased_date: '2026-04-03',
          stock_id: 'stock-12',
          price: 4.5,
          open: 1,
          row_created_timestamp: '2026-04-01T10:00:00Z',
        })),
      },
    );

    expect(updateGrocyStockEntry).toHaveBeenCalledWith(12, {
      amount: 2,
      bestBeforeDate: '2026-04-15',
      price: 4.5,
      open: true,
      locationId: 4,
      shoppingLocationId: 8,
      purchasedDate: '2026-04-03',
    });
    expect(result).toEqual({
      entryId: 12,
      updated: {
        amount: 2,
        bestBeforeDate: '2026-04-15',
        price: 4.5,
        open: true,
        locationId: 4,
        shoppingLocationId: 8,
        purchasedDate: '2026-04-03',
      },
      entry: {
        entryId: 12,
        productId: 101,
        locationId: 4,
        shoppingLocationId: 8,
        amount: 2,
        bestBeforeDate: '2026-04-15',
        purchasedDate: '2026-04-03',
        stockId: 'stock-12',
        price: 4.5,
        open: true,
        openedDate: null,
        note: null,
        rowCreatedTimestamp: '2026-04-01T10:00:00Z',
      },
    });
  });

  it('clears the best-before date on an inventory entry when null is provided', async () => {
    const updateGrocyStockEntry = vi.fn(async () => undefined);

    const result = await updateInventoryEntry(
      {
        entryId: 12,
        bestBeforeDate: null,
      },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        updateGrocyStockEntry,
        getGrocyStockEntry: vi.fn(async () => ({
          id: 12,
          product_id: 101,
          location_id: 4,
          shopping_location_id: 8,
          amount: 2,
          best_before_date: undefined,
          purchased_date: '2026-04-03',
          stock_id: 'stock-12',
          price: 4.5,
          open: 1,
          row_created_timestamp: '2026-04-01T10:00:00Z',
        })),
      },
    );

    expect(updateGrocyStockEntry).toHaveBeenCalledWith(12, {
      amount: undefined,
      bestBeforeDate: null,
      price: undefined,
      open: undefined,
      locationId: undefined,
      shoppingLocationId: undefined,
      purchasedDate: undefined,
    });
    expect(result).toEqual({
      entryId: 12,
      updated: {
        bestBeforeDate: null,
      },
      entry: {
        entryId: 12,
        productId: 101,
        locationId: 4,
        shoppingLocationId: 8,
        amount: 2,
        bestBeforeDate: null,
        purchasedDate: '2026-04-03',
        stockId: 'stock-12',
        price: 4.5,
        open: true,
        openedDate: null,
        note: null,
        rowCreatedTimestamp: '2026-04-01T10:00:00Z',
      },
    });
  });

  it('rejects inventory entry updates when no editable field is provided', async () => {
    await expect(updateInventoryEntry(
      { entryId: 12 },
      {
        acquireSyncLock: vi.fn(() => true),
        releaseSyncLock: vi.fn(),
        updateGrocyStockEntry: vi.fn(async () => undefined),
        getGrocyStockEntry: vi.fn(),
      },
    )).rejects.toThrow('Provide at least one editable stock-entry field to update.');
  });
});
