import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/grocy';
import type { ProductDetailsResponse } from '@/lib/grocy/types';
import { ProductCompensationError } from '@/lib/use-cases/products/manage';
import {
  createDeviceProduct,
  createDeviceProductFromMealieFood,
  DeviceConflictError,
  DeviceProductNotFoundError,
  DeviceUpstreamTimeoutError,
  getDeviceProduct,
  linkDeviceBarcode,
  performDeviceAction,
  scanDeviceBarcode,
  searchDeviceProducts,
  type DeviceScannerDeps,
} from '../scanner';

function grocyBadRequest(message = 'No product with barcode found'): ApiError {
  return new ApiError(
    { method: 'GET', url: '/stock/products/by-barcode/{barcode}' },
    { url: '', ok: false, status: 400, statusText: 'Bad Request', body: { error_message: message } },
    message,
  );
}

function productDetails(overrides: Partial<{
  id: number;
  name: string;
  stock: number;
  opened: number;
  min: number;
  unit: string;
  quStock: number;
  quPurchase: number;
}> = {}): ProductDetailsResponse {
  const quStock = overrides.quStock ?? 7;
  return {
    product: {
      id: overrides.id ?? 42,
      name: overrides.name ?? 'Heinz Tomato Ketchup',
      min_stock_amount: overrides.min ?? 2,
      qu_id_stock: quStock,
      qu_id_purchase: overrides.quPurchase ?? quStock,
    },
    quantity_unit_stock: { id: quStock, name: overrides.unit ?? 'Bottle' },
    stock_amount: overrides.stock ?? 3,
    stock_amount_opened: overrides.opened ?? 1,
  };
}

function createDeps(overrides: Partial<DeviceScannerDeps> = {}): DeviceScannerDeps {
  return {
    recordHistory: vi.fn().mockResolvedValue('history-run'),
    acquireSyncLock: vi.fn().mockReturnValue(true),
    releaseSyncLock: vi.fn(),
    getStockByBarcode: vi.fn().mockResolvedValue(productDetails()),
    getProductDetails: vi.fn().mockResolvedValue(productDetails()),
    listGrocyProducts: vi.fn().mockResolvedValue([
      { id: 42, name: 'Heinz Tomato Ketchup' },
      { id: 43, name: 'Whole Milk' },
      { id: 44, name: 'Greek Yoghurt' },
    ]),
    listProductBarcodes: vi.fn().mockResolvedValue([]),
    listGrocyUnits: vi.fn().mockResolvedValue([{ id: 7, name: 'Bottle' }]),
    createProductBarcode: vi.fn().mockResolvedValue({ created_object_id: 1 }),
    lookupExternalBarcode: vi.fn().mockResolvedValue(null),
    findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue(null),
    checkShoppingListProduct: vi.fn().mockResolvedValue({
      shoppingListId: 'list-1',
      alreadyOnList: false,
      matchCount: 0,
      matches: [],
    }),
    addShoppingListItem: vi.fn().mockResolvedValue({
      action: 'created',
      merged: false,
      resolved: null,
      item: { id: 'item-1', quantity: 1 },
    }),
    listUnitMappings: vi.fn().mockResolvedValue([]),
    listGrocyConversions: vi.fn().mockResolvedValue([]),
    addStock: vi.fn().mockResolvedValue({}),
    consumeStock: vi.fn().mockResolvedValue({}),
    markStockOpened: vi.fn().mockResolvedValue({}),
    createProductInBoth: vi.fn().mockResolvedValue({
      created: true,
      grocyProductId: 99,
      grocyProductName: 'New Product',
      mealieFoodId: 'food-99',
      mealieFoodName: 'New Product',
      unitMappingId: null,
      duplicateCheck: { skipped: false, exactGrocyMatches: 0, exactMealieMatches: 0 },
    }),
    resolveMappedGrocyProduct: vi.fn().mockResolvedValue(null),
    resolveDefaultGrocyUnitId: vi.fn().mockResolvedValue(7),
    listUnmappedMealieFoods: vi.fn().mockResolvedValue([]),
    getMealieFood: vi.fn().mockResolvedValue({ id: 'food-5', name: 'Oat Milk' }),
    createProductForMealieFood: vi.fn().mockResolvedValue({
      created: true, grocyProductId: 77, grocyProductName: 'Oat Milk', unitMappingId: 'um-1',
    }),
    ...overrides,
  } as DeviceScannerDeps;
}

describe('scanDeviceBarcode', () => {
  it('returns the found variant for a known barcode', async () => {
    const deps = createDeps();
    const result = await scanDeviceBarcode('8715700110622', deps);

    expect(result).toEqual({
      status: 'found',
      product: {
        id: 42,
        name: 'Heinz Tomato Ketchup',
        quantityUnit: 'Bottle',
        stockAmount: 3,
        openedAmount: 1,
        minStockAmount: 2,
        onShoppingList: false,
        shoppingListAmount: 0,
      },
    });
  });

  it('reports onShoppingList even when matched rows sum to zero quantity', async () => {
    const deps = createDeps({
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-1'),
      checkShoppingListProduct: vi.fn().mockResolvedValue({
        shoppingListId: 'list-1',
        alreadyOnList: true,
        matchCount: 1,
        matches: [{ quantity: 0 }],
      }),
    });

    const result = await scanDeviceBarcode('8715700110622', deps);
    expect(result.status).toBe('found');
    // Boolean comes from the check, not the summed amount: a quantity-0 row is
    // still on the list.
    expect(result.status === 'found' && result.product.onShoppingList).toBe(true);
    expect(result.status === 'found' && result.product.shoppingListAmount).toBe(0);
    expect(deps.checkShoppingListProduct).toHaveBeenCalledWith({ foodId: 'food-1' });
  });

  it('sums the quantity of every matching unchecked row into shoppingListAmount', async () => {
    const deps = createDeps({
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-1'),
      checkShoppingListProduct: vi.fn().mockResolvedValue({
        shoppingListId: 'list-1',
        alreadyOnList: true,
        matchCount: 3,
        // Non-finite / negative quantities are ignored by the sum.
        matches: [{ quantity: 2 }, { quantity: 1.5 }, { quantity: Number.NaN }],
      }),
    });

    const result = await scanDeviceBarcode('8715700110622', deps);
    expect(result.status === 'found' && result.product.onShoppingList).toBe(true);
    expect(result.status === 'found' && result.product.shoppingListAmount).toBe(3.5);
  });

  describe('shoppingListAmount in the stock unit', () => {
    // Milk counted in packs; 1 pak = 1000 ml for this product.
    const milk = () => productDetails({ id: 27, name: 'Melk', unit: 'pak', quStock: 3, quPurchase: 3 });
    const milkMappings = [
      { mealieUnitId: 'mealie-pak', grocyUnitId: 3, conversionFactor: 1 },
      { mealieUnitId: 'mealie-ml', grocyUnitId: 17, conversionFactor: 1 },
    ];
    const milkConversions = [
      { id: 97, from_qu_id: 3, to_qu_id: 17, factor: 1000, product_id: 27 },
      { id: 98, from_qu_id: 17, to_qu_id: 3, factor: 0.001, product_id: 27 },
    ];
    const listed = (matches: Array<{ quantity: number; unitId?: string | null }>) => vi.fn().mockResolvedValue({
      shoppingListId: 'list-1', alreadyOnList: matches.length > 0, matchCount: matches.length, matches,
    });
    const scanAmount = async (deps: DeviceScannerDeps) => {
      const result = await scanDeviceBarcode('8715700110622', deps);
      if (result.status !== 'found') throw new Error('expected a found scan');
      return result.product;
    };

    it('converts rows in other units, so 1000 ml and 2 pak are 3 pak', async () => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        checkShoppingListProduct: listed([{ quantity: 1000, unitId: 'mealie-ml' }, { quantity: 2, unitId: 'mealie-pak' }]),
        listUnitMappings: vi.fn().mockResolvedValue(milkMappings),
        listGrocyConversions: vi.fn().mockResolvedValue(milkConversions),
      });

      const product = await scanAmount(deps);
      expect(product).toMatchObject({ quantityUnit: 'pak', onShoppingList: true, shoppingListAmount: 3 });
      expect(deps.listGrocyConversions).toHaveBeenCalledTimes(1);
    });

    it.each([
      { rows: [{ quantity: 1000, unitId: 'mealie-ml' }, { quantity: 1, unitId: 'mealie-pak' }], expected: 2 },
      { rows: [{ quantity: 1500, unitId: 'mealie-ml' }, { quantity: 1, unitId: 'mealie-pak' }], expected: 2.5 },
      { rows: [{ quantity: 1500, unitId: 'mealie-ml' }, { quantity: 2, unitId: 'mealie-pak' }], expected: 3.5 },
      { rows: [{ quantity: 250, unitId: 'mealie-ml' }], expected: 0.3 },
      { rows: [{ quantity: 1 / 3, unitId: null }], expected: 0.4 },
      // Rounded once on the total, not per row.
      { rows: [{ quantity: 1 / 3, unitId: null }, { quantity: 1 / 3, unitId: null }, { quantity: 1 / 3, unitId: null }], expected: 1 },
      // Floating point noise (0.1 + 0.2) is not rounded up, a real excess is.
      { rows: [{ quantity: 0.1, unitId: null }, { quantity: 0.2, unitId: null }], expected: 0.3 },
      { rows: [{ quantity: 0.300001, unitId: null }], expected: 0.4 },
    ])('rounds the amount up to one decimal ($expected)', async ({ rows, expected }) => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        checkShoppingListProduct: listed(rows),
        listUnitMappings: vi.fn().mockResolvedValue(milkMappings),
        listGrocyConversions: vi.fn().mockResolvedValue(milkConversions),
      });

      expect((await scanAmount(deps)).shoppingListAmount).toBe(expected);
    });

    it('does not load Grocy conversions when every row is in the stock unit', async () => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        checkShoppingListProduct: listed([{ quantity: 2, unitId: 'mealie-pak' }, { quantity: 1, unitId: null }]),
        listUnitMappings: vi.fn().mockResolvedValue(milkMappings),
      });

      expect((await scanAmount(deps)).shoppingListAmount).toBe(3);
      expect(deps.listGrocyConversions).not.toHaveBeenCalled();
    });

    it('leaves rows out that cannot be converted exactly but keeps the product on the list', async () => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        // An unmapped Mealie unit, and a mapped unit without a Grocy conversion.
        checkShoppingListProduct: listed([{ quantity: 1, unitId: 'mealie-fles' }, { quantity: 6, unitId: 'mealie-glas' }]),
        listUnitMappings: vi.fn().mockResolvedValue([...milkMappings, { mealieUnitId: 'mealie-glas', grocyUnitId: 21, conversionFactor: 1 }]),
        listGrocyConversions: vi.fn().mockResolvedValue(milkConversions),
      });

      expect(await scanAmount(deps)).toMatchObject({ onShoppingList: true, shoppingListAmount: 0 });
    });

    it('leaves rows in a purchase unit that differs from the stock unit out', async () => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(productDetails({ unit: 'gram', quStock: 5, quPurchase: 9 })),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-1'),
        checkShoppingListProduct: listed([{ quantity: 2, unitId: 'mealie-zak' }, { quantity: 250, unitId: 'mealie-gram' }]),
        listUnitMappings: vi.fn().mockResolvedValue([
          { mealieUnitId: 'mealie-zak', grocyUnitId: 9, conversionFactor: 1 },
          { mealieUnitId: 'mealie-gram', grocyUnitId: 5, conversionFactor: 1 },
        ]),
      });

      expect((await scanAmount(deps)).shoppingListAmount).toBe(250);
    });

    it('follows each product\'s own stock unit', async () => {
      // Stock in gram; a Mealie kilogram maps onto gram with factor 1000.
      const flour = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(productDetails({ unit: 'gram', quStock: 5, quPurchase: 5 })),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-flour'),
        checkShoppingListProduct: listed([{ quantity: 0.5, unitId: 'mealie-kg' }, { quantity: 250, unitId: 'mealie-gram' }]),
        listUnitMappings: vi.fn().mockResolvedValue([
          { mealieUnitId: 'mealie-kg', grocyUnitId: 5, conversionFactor: 1000 },
          { mealieUnitId: 'mealie-gram', grocyUnitId: 5, conversionFactor: 1 },
        ]),
      });
      expect((await scanAmount(flour)).shoppingListAmount).toBe(750);

      // Stock in pieces bought per pack: an unlabelled row still counts pieces.
      const eggs = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(productDetails({ unit: 'Stuk', quStock: 2, quPurchase: 11 })),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-eggs'),
        checkShoppingListProduct: listed([{ quantity: 6, unitId: null }]),
      });
      expect((await scanAmount(eggs)).shoppingListAmount).toBe(6);
    });

    it.each([
      ['fails', () => Promise.reject(new Error('Grocy down'))],
      ['is too slow', () => new Promise<never>(() => {})],
    ])('keeps the list check and directly convertible rows when loading conversions %s', async (_label, listGrocyConversions) => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        checkShoppingListProduct: listed([{ quantity: 1000, unitId: 'mealie-ml' }, { quantity: 2, unitId: 'mealie-pak' }]),
        listUnitMappings: vi.fn().mockResolvedValue(milkMappings),
        listGrocyConversions: vi.fn(listGrocyConversions),
      });

      expect(await scanAmount(deps)).toMatchObject({ onShoppingList: true, shoppingListAmount: 2 });
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('skips rows whose unit mapping has factor %s', async factor => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        checkShoppingListProduct: listed([{ quantity: 2, unitId: 'mealie-pak' }, { quantity: 1, unitId: 'mealie-bad' }]),
        listUnitMappings: vi.fn().mockResolvedValue([...milkMappings, { mealieUnitId: 'mealie-bad', grocyUnitId: 3, conversionFactor: factor }]),
      });

      expect((await scanAmount(deps)).shoppingListAmount).toBe(2);
    });

    it('reports 0 instead of an overflowing sum', async () => {
      const deps = createDeps({
        getStockByBarcode: vi.fn().mockResolvedValue(milk()),
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
        checkShoppingListProduct: listed([{ quantity: 1e308, unitId: null }, { quantity: 1e308, unitId: null }]),
      });

      expect(await scanAmount(deps)).toMatchObject({ onShoppingList: true, shoppingListAmount: 0 });
    });
  });

  it('falls back to no shopping-list state when no Mealie food is mapped', async () => {
    const deps = createDeps({
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue(null),
    });

    const result = await scanDeviceBarcode('8715700110622', deps);
    expect(result.status === 'found' && result.product.onShoppingList).toBe(false);
    expect(result.status === 'found' && result.product.shoppingListAmount).toBe(0);
    expect(deps.checkShoppingListProduct).not.toHaveBeenCalled();
  });

  it('returns the unknown variant with external lookup and fuzzy suggestions', async () => {
    const deps = createDeps({
      getStockByBarcode: vi.fn().mockRejectedValue(grocyBadRequest()),
      lookupExternalBarcode: vi.fn().mockResolvedValue({
        source: 'openfoodfacts',
        name: 'Tomato Ketchup',
        brand: 'Heinz',
        quantity: '570 g',
      }),
    });

    const result = await scanDeviceBarcode('8715700110622', deps);

    expect(result.status).toBe('unknown');
    if (result.status !== 'unknown') return;
    expect(result.barcode).toBe('8715700110622');
    expect(result.externalLookup?.name).toBe('Tomato Ketchup');
    expect(result.suggestedMatches.length).toBeGreaterThan(0);
    expect(result.suggestedMatches[0]).toMatchObject({ id: 42, name: 'Heinz Tomato Ketchup' });
    expect(result.suggestedMatches[0].score).toBeGreaterThan(0);
    expect(result.suggestedMatches[0].score).toBeLessThanOrEqual(1);
  });

  it('returns unknown with null externalLookup when the lookup fails', async () => {
    const deps = createDeps({
      getStockByBarcode: vi.fn().mockRejectedValue(grocyBadRequest()),
      lookupExternalBarcode: vi.fn().mockResolvedValue(null),
    });

    const result = await scanDeviceBarcode('0000000000000', deps);

    expect(result.status).toBe('unknown');
    if (result.status !== 'unknown') return;
    expect(result.externalLookup).toBeNull();
  });

  it('rethrows non-400 Grocy errors', async () => {
    const error = new Error('connection refused');
    const deps = createDeps({ getStockByBarcode: vi.fn().mockRejectedValue(error) });

    await expect(scanDeviceBarcode('8715700110622', deps)).rejects.toThrow('connection refused');
  });

  it('times out slow Grocy barcode lookups', async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps({
        getStockByBarcode: vi.fn(() => new Promise<ProductDetailsResponse>(() => {})),
      });

      const result = scanDeviceBarcode('8715700110622', deps);
      const assertion = expect(result).rejects.toBeInstanceOf(DeviceUpstreamTimeoutError);
      await vi.advanceTimersByTimeAsync(6_500);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not block found scans on a slow Mealie shopping list check', async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps({
        findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-1'),
        checkShoppingListProduct: vi.fn(
          () => new Promise<Awaited<ReturnType<DeviceScannerDeps['checkShoppingListProduct']>>>(() => {}),
        ),
      });

      const result = scanDeviceBarcode('8715700110622', deps);
      const assertion = expect(result).resolves.toMatchObject({
        status: 'found',
        product: { onShoppingList: false, shoppingListAmount: 0 },
      });
      await vi.advanceTimersByTimeAsync(1_200);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('scanner activity history', () => {
  it('records a confirmed purchase with its product, amount and stock change', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValueOnce(productDetails({ stock: 3 })).mockResolvedValueOnce(productDetails({ stock: 5 })),
    });
    await performDeviceAction({ productId: 42, action: 'purchase', amount: 2 }, deps);
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'scanner', action: 'inventory_add_stock', status: 'success',
      events: [expect.objectContaining({
        kind: 'mutation', productName: 'Heinz Tomato Ketchup', source: 'Scanner', target: 'Grocy',
        details: expect.objectContaining({ amount: 2, stockBefore: 3, stockAfter: 5 }),
      })],
    }));
  });

  it('keeps the successful write when refreshing stock fails afterwards', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValueOnce(productDetails()).mockRejectedValueOnce(new Error('Stock refresh failed')),
    });
    await expect(performDeviceAction({ productId: 42, action: 'consume' }, deps)).rejects.toThrow('Stock refresh failed');
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'scanner', status: 'partial', events: [
        expect.objectContaining({ kind: 'mutation', productName: 'Heinz Tomato Ketchup' }),
        expect.objectContaining({ kind: 'issue', message: 'Scanner action failed: Stock refresh failed' }),
      ],
    }));
  });

  it('records insufficient stock as a searchable issue without a mutation', async () => {
    const deps = createDeps();
    await expect(performDeviceAction({ productId: 42, action: 'consume', amount: 10 }, deps)).rejects.toThrow('Not enough in stock');
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failure', events: [expect.objectContaining({ kind: 'issue', productName: 'Heinz Tomato Ketchup' })],
    }));
    expect(deps.consumeStock).not.toHaveBeenCalled();
  });

  it('records a shopping list request separately from stock actions', async () => {
    const deps = createDeps();
    await performDeviceAction({ productId: 42, action: 'add_to_shopping_list' }, deps);
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      action: 'shopping_add_item', events: [expect.objectContaining({ source: 'Scanner', target: 'Mealie', kind: 'mutation' })],
    }));
  });

  it('records barcode linking once and omits an already-linked barcode', async () => {
    const deps = createDeps();
    await linkDeviceBarcode({ productId: 42, barcode: '123456' }, deps);
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      action: 'product_link_barcode', events: [expect.objectContaining({ kind: 'mutation', productName: 'Heinz Tomato Ketchup' })],
    }));
    const unchanged = createDeps({ listProductBarcodes: vi.fn().mockResolvedValue([{ barcode: '123456', product_id: 42 }]) });
    await linkDeviceBarcode({ productId: 42, barcode: '123456' }, unchanged);
    expect(unchanged.recordHistory).not.toHaveBeenCalled();
  });

  it('keeps product creation if linking its barcode fails', async () => {
    const deps = createDeps({ createProductBarcode: vi.fn().mockRejectedValue(new Error('Barcode write failed')) });
    await expect(createDeviceProduct({ name: 'New Product', barcode: '123456' }, deps)).rejects.toThrow('Barcode write failed');
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      status: 'partial', events: [expect.objectContaining({ kind: 'mutation', productName: 'New Product' }), expect.objectContaining({ kind: 'issue' })],
    }));
  });

  it('does not fail a completed action when storing history fails', async () => {
    const deps = createDeps({ recordHistory: vi.fn().mockRejectedValue(new Error('History unavailable')) });
    await expect(performDeviceAction({ productId: 42, action: 'purchase' }, deps)).resolves.toMatchObject({ ok: true });
  });
});

describe('performDeviceAction', () => {
  it('purchase adds stock and reports before/after', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn()
        .mockResolvedValueOnce(productDetails({ stock: 3 }))
        .mockResolvedValueOnce(productDetails({ stock: 4 })),
    });

    const result = await performDeviceAction({ productId: 42, action: 'purchase' }, deps);

    expect(deps.addStock).toHaveBeenCalledWith({ productRef: 'grocy:42', amount: 1 });
    expect(result.stock).toEqual({ before: 3, after: 4 });
    expect(result.product).toEqual({ id: 42, name: 'Heinz Tomato Ketchup' });
    expect(result.shoppingList).toBeNull();
  });

  it('open marks stock opened', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn()
        .mockResolvedValueOnce(productDetails({ stock: 3, opened: 1 }))
        .mockResolvedValueOnce(productDetails({ stock: 3, opened: 2 })),
    });

    const result = await performDeviceAction({ productId: 42, action: 'open' }, deps);

    expect(deps.markStockOpened).toHaveBeenCalledWith({ productRef: 'grocy:42', amount: 1 });
    expect(result.opened).toEqual({ before: 1, after: 2 });
  });

  it('open rejects when no unopened stock remains', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ stock: 2, opened: 2 })),
    });

    await expect(performDeviceAction({ productId: 42, action: 'open' }, deps))
      .rejects.toBeInstanceOf(DeviceConflictError);
    expect(deps.markStockOpened).not.toHaveBeenCalled();
  });

  it('consume rejects when stock is insufficient', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ stock: 0, opened: 0 })),
    });

    await expect(performDeviceAction({ productId: 42, action: 'consume' }, deps))
      .rejects.toBeInstanceOf(DeviceConflictError);
    expect(deps.consumeStock).not.toHaveBeenCalled();
  });

  it('add_to_shopping_list uses the mapped Mealie food id', async () => {
    const deps = createDeps({
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-1'),
      addShoppingListItem: vi.fn().mockResolvedValue({
        action: 'updated',
        merged: true,
        resolved: null,
        item: { id: 'item-9', quantity: 2 },
      }),
    });

    const result = await performDeviceAction(
      { productId: 42, action: 'add_to_shopping_list' },
      deps,
    );

    expect(deps.addShoppingListItem).toHaveBeenCalledWith({ foodId: 'food-1', quantity: 1, unitId: null });
    expect(result.shoppingList).toEqual({ itemId: 'item-9', quantity: 2 });
    expect(result.stock).toEqual({ before: 3, after: 3 });
  });

  it('add_to_shopping_list falls back to the grocy product ref without a mapping', async () => {
    const deps = createDeps();

    await performDeviceAction({ productId: 42, action: 'add_to_shopping_list' }, deps);

    expect(deps.addShoppingListItem).toHaveBeenCalledWith({
      query: 'grocy:42',
      quantity: 1,
      unitId: null,
    });
  });

  it('add_to_shopping_list adds in the stock unit\'s Mealie unit and reports the row in stock units', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ id: 27, name: 'Melk', unit: 'pak', quStock: 3, quPurchase: 3 })),
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
      listUnitMappings: vi.fn().mockResolvedValue([
        { mealieUnitId: 'mealie-ml', grocyUnitId: 17, conversionFactor: 1 },
        { mealieUnitId: 'mealie-pak', grocyUnitId: 3, conversionFactor: 1 },
      ]),
      addShoppingListItem: vi.fn().mockResolvedValue({ action: 'updated', merged: true, resolved: null, item: { id: 'row-pak', quantity: 3 } }),
    });

    const result = await performDeviceAction({ productId: 27, action: 'add_to_shopping_list' }, deps);

    expect(deps.addShoppingListItem).toHaveBeenCalledWith({ foodId: 'food-milk', quantity: 1, unitId: 'mealie-pak' });
    expect(result.shoppingList).toEqual({ itemId: 'row-pak', quantity: 3 });
  });

  it('add_to_shopping_list converts the amount when the Mealie unit holds several stock units', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ name: 'Socks', unit: 'Stuk', quStock: 2, quPurchase: 2 })),
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-socks'),
      listUnitMappings: vi.fn().mockResolvedValue([{ mealieUnitId: 'mealie-pair', grocyUnitId: 2, conversionFactor: 2 }]),
      addShoppingListItem: vi.fn().mockResolvedValue({ action: 'updated', merged: true, resolved: null, item: { id: 'row-pair', quantity: 2 } }),
    });

    const result = await performDeviceAction({ productId: 42, action: 'add_to_shopping_list', amount: 1 }, deps);

    expect(deps.addShoppingListItem).toHaveBeenCalledWith({ foodId: 'food-socks', quantity: 0.5, unitId: 'mealie-pair' });
    expect(result.shoppingList).toEqual({ itemId: 'row-pair', quantity: 4 });
  });

  it('add_to_shopping_list rounds only the reported quantity up to one decimal', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ id: 27, name: 'Melk', unit: 'pak', quStock: 3, quPurchase: 3 })),
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-milk'),
      listUnitMappings: vi.fn().mockResolvedValue([{ mealieUnitId: 'mealie-pak', grocyUnitId: 3, conversionFactor: 1 }]),
      addShoppingListItem: vi.fn().mockResolvedValue({ action: 'created', merged: false, resolved: null, item: { id: 'row-pak', quantity: 0.25 } }),
    });

    const result = await performDeviceAction({ productId: 27, action: 'add_to_shopping_list', amount: 0.25 }, deps);

    // Mealie gets the exact amount; only the number for the scanner is rounded.
    expect(deps.addShoppingListItem).toHaveBeenCalledWith({ foodId: 'food-milk', quantity: 0.25, unitId: 'mealie-pak' });
    expect(result.shoppingList).toEqual({ itemId: 'row-pak', quantity: 0.3 });
  });

  it('add_to_shopping_list writes nothing when the stock unit has no unambiguous Mealie unit', async () => {
    // Stock in kilogram, bought per bag, no unit mapping: an unlabelled "1" could mean a bag.
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ name: 'Flour', unit: 'kilogram', quStock: 14, quPurchase: 9 })),
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-flour'),
    });

    await expect(performDeviceAction({ productId: 42, action: 'add_to_shopping_list' }, deps))
      .rejects.toBeInstanceOf(DeviceConflictError);
    expect(deps.addShoppingListItem).not.toHaveBeenCalled();
  });

  it('holds the sync lock across stock-mutating actions', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn()
        .mockResolvedValueOnce(productDetails({ stock: 3 }))
        .mockResolvedValueOnce(productDetails({ stock: 4 })),
    });

    await performDeviceAction({ productId: 42, action: 'purchase' }, deps);

    expect(deps.acquireSyncLock).toHaveBeenCalled();
    expect(deps.releaseSyncLock).toHaveBeenCalled();
  });

  it('does not take the sync lock for add_to_shopping_list', async () => {
    const deps = createDeps();

    await performDeviceAction({ productId: 42, action: 'add_to_shopping_list' }, deps);

    expect(deps.acquireSyncLock).not.toHaveBeenCalled();
  });

  it('maps an unknown product id to DeviceProductNotFoundError', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockRejectedValue(grocyBadRequest('Product does not exist')),
    });

    await expect(performDeviceAction({ productId: 9999, action: 'purchase' }, deps))
      .rejects.toBeInstanceOf(DeviceProductNotFoundError);
  });
});

describe('searchDeviceProducts', () => {
  it('returns fuzzy matches with stock amounts', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ id: 43, name: 'Whole Milk', stock: 5 })),
    });

    const result = await searchDeviceProducts({ query: 'milk' }, deps);

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toEqual({ id: 43, name: 'Whole Milk', stockAmount: 5 });
  });

  it('omits the source field and skips Mealie without the opt-in', async () => {
    const deps = createDeps({
      listUnmappedMealieFoods: vi.fn().mockResolvedValue([{ id: 'food-5', name: 'Oat Milk' }]),
    });

    const result = await searchDeviceProducts({ query: 'milk' }, deps);

    expect(deps.listUnmappedMealieFoods).not.toHaveBeenCalled();
    expect(result.results.every(entry => !('source' in entry))).toBe(true);
  });

  it('adds unmapped Mealie foods after the Grocy matches when included', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ id: 43, name: 'Whole Milk', stock: 5 })),
      listUnmappedMealieFoods: vi.fn().mockResolvedValue([
        { id: 'food-5', name: 'Oat Milk' },
        { id: 'food-6', name: 'Basil' },
      ]),
    });

    const result = await searchDeviceProducts({ query: 'milk', includeMealie: true }, deps);

    expect(result.results[0]).toEqual({ id: 43, name: 'Whole Milk', stockAmount: 5, source: 'grocy' });
    expect(result.results).toContainEqual({
      id: 0, name: 'Oat Milk', stockAmount: 0, source: 'mealie', mealieFoodId: 'food-5',
    });
    expect(result.results.some(entry => entry.name === 'Basil')).toBe(false);
  });

  it('degrades to Grocy results when the Mealie lookup fails', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(productDetails({ id: 43, name: 'Whole Milk', stock: 5 })),
      listUnmappedMealieFoods: vi.fn().mockRejectedValue(new Error('mealie down')),
    });

    const result = await searchDeviceProducts({ query: 'milk', includeMealie: true }, deps);

    expect(result.results).toEqual([{ id: 43, name: 'Whole Milk', stockAmount: 5, source: 'grocy' }]);
  });

  it('returns the Grocy results when the Mealie lookup stalls', async () => {
    vi.useFakeTimers();
    try {
      const deps = createDeps({
        getProductDetails: vi.fn().mockResolvedValue(productDetails({ id: 43, name: 'Whole Milk', stock: 5 })),
        listUnmappedMealieFoods: vi.fn().mockReturnValue(new Promise(() => {})),
      });

      const pending = searchDeviceProducts({ query: 'milk', includeMealie: true }, deps);
      await vi.advanceTimersByTimeAsync(2_500);
      const result = await pending;

      expect(result.results).toEqual([{ id: 43, name: 'Whole Milk', stockAmount: 5, source: 'grocy' }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects an empty query', async () => {
    await expect(searchDeviceProducts({ query: '   ' }, createDeps()))
      .rejects.toThrow('Query must not be empty.');
  });
});

describe('createDeviceProduct', () => {
  it('creates the product in Grocy and Mealie, links the barcode and returns the product', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(
        productDetails({ id: 99, name: 'New Product', stock: 0, opened: 0, min: 0 }),
      ),
    });

    const product = await createDeviceProduct(
      { name: ' New Product ', barcode: '4006381333931' },
      deps,
    );

    // createProductInBoth creates the Grocy product, the Mealie food and the
    // mapping between them; the barcode is linked separately afterwards.
    expect(deps.createProductInBoth).toHaveBeenCalledWith({ name: 'New Product', grocyUnitId: 7 });
    expect(deps.createProductBarcode).toHaveBeenCalledWith({
      product_id: 99,
      barcode: '4006381333931',
    });
    expect(product).toMatchObject({ id: 99, name: 'New Product', stockAmount: 0 });
  });

  it('reports a duplicate Grocy name as a conflict with the existing product', async () => {
    const deps = createDeps({
      createProductInBoth: vi.fn().mockResolvedValue({
        created: false,
        grocyProductId: 42,
        grocyProductName: 'Heinz Tomato Ketchup',
        mealieFoodId: null,
        mealieFoodName: null,
        unitMappingId: null,
        duplicateCheck: { skipped: true, exactGrocyMatches: 1, exactMealieMatches: 0 },
      }),
    });

    const error = await createDeviceProduct(
      { name: 'Heinz Tomato Ketchup', barcode: '8715700110622' },
      deps,
    ).catch(e => e);

    expect(error).toBeInstanceOf(DeviceConflictError);
    expect((error as DeviceConflictError).payload).toEqual({
      product: { id: 42, name: 'Heinz Tomato Ketchup' },
    });
    expect(deps.createProductBarcode).not.toHaveBeenCalled();
  });

  it('reports a mapped Mealie duplicate as a conflict with its Grocy product', async () => {
    // The scanned name matches an existing Mealie food (by name or alias) whose
    // mapped Grocy product has a different name, so there is no exact Grocy match
    // but there is still a Grocy product to link the barcode to.
    const deps = createDeps({
      createProductInBoth: vi.fn().mockResolvedValue({
        created: false,
        grocyProductId: null,
        grocyProductName: null,
        mealieFoodId: 'food-7',
        mealieFoodName: 'Whole Milk',
        unitMappingId: null,
        duplicateCheck: { skipped: true, exactGrocyMatches: 0, exactMealieMatches: 1 },
      }),
      resolveMappedGrocyProduct: vi.fn().mockResolvedValue({ id: 43, name: 'Semi-skimmed Milk' }),
    });

    const error = await createDeviceProduct(
      { name: 'Whole Milk', barcode: '4006381333931' },
      deps,
    ).catch(e => e);

    expect(deps.resolveMappedGrocyProduct).toHaveBeenCalledWith('food-7');
    expect(error).toBeInstanceOf(DeviceConflictError);
    expect((error as DeviceConflictError).payload).toEqual({
      product: { id: 43, name: 'Semi-skimmed Milk' },
    });
    expect(deps.createProductBarcode).not.toHaveBeenCalled();
  });

  it('surfaces an unmapped Mealie-only duplicate as a plain error (no Grocy id to link)', async () => {
    const deps = createDeps({
      createProductInBoth: vi.fn().mockResolvedValue({
        created: false,
        grocyProductId: null,
        grocyProductName: null,
        mealieFoodId: 'food-7',
        mealieFoodName: 'New Product',
        unitMappingId: null,
        duplicateCheck: { skipped: true, exactGrocyMatches: 0, exactMealieMatches: 1 },
      }),
      resolveMappedGrocyProduct: vi.fn().mockResolvedValue(null),
    });

    const error = await createDeviceProduct(
      { name: 'New Product', barcode: '4006381333931' },
      deps,
    ).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(DeviceConflictError);
    expect(deps.createProductBarcode).not.toHaveBeenCalled();
  });

  it('falls back to the first Grocy unit when no default unit is configured', async () => {
    const deps = createDeps({
      resolveDefaultGrocyUnitId: vi.fn().mockResolvedValue(null),
      listGrocyUnits: vi.fn().mockResolvedValue([{ id: 3, name: 'Piece' }]),
    });

    await createDeviceProduct({ name: 'New Product', barcode: '4006381333931' }, deps);

    expect(deps.createProductInBoth).toHaveBeenCalledWith({ name: 'New Product', grocyUnitId: 3 });
  });
});

describe('createDeviceProductFromMealieFood', () => {
  const params = { mealieFoodId: 'food-5', barcode: '4006381333931' };

  function mealieDeps(overrides: Partial<DeviceScannerDeps> = {}) {
    return createDeps({
      getProductDetails: vi.fn().mockResolvedValue(
        productDetails({ id: 77, name: 'Oat Milk', stock: 0, opened: 0, min: 0 }),
      ),
      ...overrides,
    });
  }

  it('creates and maps the Grocy product from the Mealie food, then links the barcode', async () => {
    const deps = mealieDeps();

    const product = await createDeviceProductFromMealieFood(params, deps);

    expect(deps.createProductForMealieFood).toHaveBeenCalledWith({
      mealieFoodId: 'food-5', mealieFoodName: 'Oat Milk', grocyUnitId: 7,
    });
    expect(deps.createProductBarcode).toHaveBeenCalledWith({ product_id: 77, barcode: '4006381333931' });
    expect(deps.createProductInBoth).not.toHaveBeenCalled();
    expect(product).toMatchObject({ id: 77, name: 'Oat Milk' });
    expect(deps.releaseSyncLock).toHaveBeenCalled();
  });

  it('falls back to the first Grocy unit when no default unit is configured', async () => {
    const deps = mealieDeps({
      resolveDefaultGrocyUnitId: vi.fn().mockResolvedValue(null),
      listGrocyUnits: vi.fn().mockResolvedValue([{ id: 3, name: 'Piece' }]),
    });

    await createDeviceProductFromMealieFood(params, deps);

    expect(deps.createProductForMealieFood).toHaveBeenCalledWith(expect.objectContaining({ grocyUnitId: 3 }));
  });

  it('404s when the Mealie food no longer exists', async () => {
    const deps = mealieDeps({ getMealieFood: vi.fn().mockResolvedValue(null) });

    await expect(createDeviceProductFromMealieFood(params, deps))
      .rejects.toBeInstanceOf(DeviceProductNotFoundError);
    expect(deps.createProductForMealieFood).not.toHaveBeenCalled();
  });

  it('reports an already mapped food as a conflict with its Grocy product', async () => {
    const deps = mealieDeps({
      resolveMappedGrocyProduct: vi.fn().mockResolvedValue({ id: 43, name: 'Whole Milk' }),
    });

    const error = await createDeviceProductFromMealieFood(params, deps).catch(e => e);

    expect(error).toBeInstanceOf(DeviceConflictError);
    expect((error as DeviceConflictError).payload).toEqual({ product: { id: 43, name: 'Whole Milk' } });
    expect(deps.createProductForMealieFood).not.toHaveBeenCalled();
  });

  it('refuses before any mutation when the barcode belongs to another product', async () => {
    const deps = mealieDeps({
      listProductBarcodes: vi.fn().mockResolvedValue([{ product_id: 42, barcode: '4006381333931' }]),
    });

    await expect(createDeviceProductFromMealieFood(params, deps)).rejects.toBeInstanceOf(DeviceConflictError);
    expect(deps.createProductForMealieFood).not.toHaveBeenCalled();
  });

  it('reports an exact Grocy name match as a conflict without linking', async () => {
    const deps = mealieDeps({
      createProductForMealieFood: vi.fn().mockResolvedValue({
        created: false, grocyProductId: 50, grocyProductName: 'Oat Milk', unitMappingId: null,
      }),
    });

    const error = await createDeviceProductFromMealieFood(params, deps).catch(e => e);

    expect(error).toBeInstanceOf(DeviceConflictError);
    expect((error as DeviceConflictError).payload).toEqual({ product: { id: 50, name: 'Oat Milk' } });
    expect(deps.createProductBarcode).not.toHaveBeenCalled();
  });

  it('records a partial run when linking the barcode fails after the mapping succeeded', async () => {
    const deps = mealieDeps({ createProductBarcode: vi.fn().mockRejectedValue(new Error('grocy down')) });

    await expect(createDeviceProductFromMealieFood(params, deps)).rejects.toThrow('grocy down');

    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }));
  });

  it('records a partial run when the orphaned Grocy product could not be removed', async () => {
    const deps = mealieDeps({
      createProductForMealieFood: vi.fn().mockRejectedValue(
        new ProductCompensationError(77, new Error('db'), new Error('grocy')),
      ),
    });

    await expect(createDeviceProductFromMealieFood(params, deps)).rejects.toBeInstanceOf(ProductCompensationError);

    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }));
  });

  it('runs concurrent picks of the same food one after the other under the sync lock', async () => {
    let locked = false;
    let mapped: { id: number; name: string } | null = null;
    const deps = mealieDeps({
      acquireSyncLock: vi.fn().mockImplementation(() => {
        if (locked) return false;
        locked = true;
        return true;
      }),
      releaseSyncLock: vi.fn().mockImplementation(() => { locked = false; }),
      resolveMappedGrocyProduct: vi.fn().mockImplementation(async () => mapped),
      createProductForMealieFood: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        mapped = { id: 77, name: 'Oat Milk' };
        return { created: true, grocyProductId: 77, grocyProductName: 'Oat Milk', unitMappingId: null };
      }),
    });

    const results = await Promise.allSettled([
      createDeviceProductFromMealieFood(params, deps),
      createDeviceProductFromMealieFood(params, deps),
    ]);

    expect(deps.createProductForMealieFood).toHaveBeenCalledTimes(1);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(DeviceConflictError);
  });
});

describe('linkDeviceBarcode', () => {
  it('links the barcode and returns the product', async () => {
    const deps = createDeps();

    const product = await linkDeviceBarcode({ productId: 42, barcode: '8715700110622' }, deps);

    expect(deps.createProductBarcode).toHaveBeenCalledWith({
      product_id: 42,
      barcode: '8715700110622',
    });
    // Shared toDeviceProduct mapping carries the shopping-list fields here too.
    expect(product).toMatchObject({
      id: 42,
      name: 'Heinz Tomato Ketchup',
      onShoppingList: false,
      shoppingListAmount: 0,
    });
  });

  it('is idempotent when the barcode is already linked to the same product', async () => {
    const deps = createDeps({
      listProductBarcodes: vi.fn().mockResolvedValue([
        { product_id: 42, barcode: '8715700110622' },
      ]),
    });

    const product = await linkDeviceBarcode({ productId: 42, barcode: '8715700110622' }, deps);

    expect(deps.createProductBarcode).not.toHaveBeenCalled();
    expect(product.id).toBe(42);
  });

  it('conflicts when the barcode belongs to another product', async () => {
    const deps = createDeps({
      listProductBarcodes: vi.fn().mockResolvedValue([
        { product_id: 43, barcode: '8715700110622' },
      ]),
      getProductDetails: vi.fn()
        .mockResolvedValueOnce(productDetails({ id: 42 }))
        .mockResolvedValueOnce(productDetails({ id: 43, name: 'Whole Milk' })),
    });

    const error = await linkDeviceBarcode({ productId: 42, barcode: '8715700110622' }, deps)
      .catch(e => e);

    expect(error).toBeInstanceOf(DeviceConflictError);
    expect((error as DeviceConflictError).payload).toEqual({
      product: { id: 43, name: 'Whole Milk' },
    });
  });
});

describe('getDeviceProduct', () => {
  it('returns the full product in the scan "found" shape', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(
        productDetails({ id: 43, name: 'Whole Milk', stock: 5, opened: 2, min: 1, unit: 'Carton' }),
      ),
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-43'),
      checkShoppingListProduct: vi.fn().mockResolvedValue({
        shoppingListId: 'list-1',
        alreadyOnList: true,
        matchCount: 2,
        matches: [{ quantity: 1 }, { quantity: 2 }],
      }),
    });

    const product = await getDeviceProduct(43, deps);

    expect(deps.getProductDetails).toHaveBeenCalledWith(43);
    // The shared toDeviceProduct mapping populates the shopping-list fields on
    // the GET /products/{id} path too.
    expect(product).toMatchObject({
      id: 43,
      name: 'Whole Milk',
      quantityUnit: 'Carton',
      stockAmount: 5,
      openedAmount: 2,
      minStockAmount: 1,
      onShoppingList: true,
      shoppingListAmount: 3,
    });
  });

  it('maps an unknown product id to DeviceProductNotFoundError', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockRejectedValue(grocyBadRequest('Product does not exist')),
    });

    await expect(getDeviceProduct(999, deps))
      .rejects.toBeInstanceOf(DeviceProductNotFoundError);
  });
});
