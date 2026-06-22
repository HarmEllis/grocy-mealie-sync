import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/grocy';
import type { ProductDetailsResponse } from '@/lib/grocy/types';
import {
  createDeviceProduct,
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
}> = {}): ProductDetailsResponse {
  return {
    product: {
      id: overrides.id ?? 42,
      name: overrides.name ?? 'Heinz Tomato Ketchup',
      min_stock_amount: overrides.min ?? 2,
    },
    quantity_unit_stock: { id: 7, name: overrides.unit ?? 'Bottle' },
    stock_amount: overrides.stock ?? 3,
    stock_amount_opened: overrides.opened ?? 1,
  };
}

function createDeps(overrides: Partial<DeviceScannerDeps> = {}): DeviceScannerDeps {
  return {
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
    addStock: vi.fn().mockResolvedValue({}),
    consumeStock: vi.fn().mockResolvedValue({}),
    markStockOpened: vi.fn().mockResolvedValue({}),
    createProductInGrocy: vi.fn().mockResolvedValue({
      created: true,
      grocyProductId: 99,
      grocyProductName: 'New Product',
      duplicateCheck: { skipped: false, exactGrocyMatches: 0 },
    }),
    resolveDefaultGrocyUnitId: vi.fn().mockResolvedValue(7),
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
      },
    });
  });

  it('reports onShoppingList via the product mapping', async () => {
    const deps = createDeps({
      findMealieFoodIdForGrocyProduct: vi.fn().mockResolvedValue('food-1'),
      checkShoppingListProduct: vi.fn().mockResolvedValue({
        shoppingListId: 'list-1',
        alreadyOnList: true,
        matchCount: 1,
        matches: [],
      }),
    });

    const result = await scanDeviceBarcode('8715700110622', deps);
    expect(result.status).toBe('found');
    expect(result.status === 'found' && result.product.onShoppingList).toBe(true);
    expect(deps.checkShoppingListProduct).toHaveBeenCalledWith({ foodId: 'food-1' });
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
        product: { onShoppingList: false },
      });
      await vi.advanceTimersByTimeAsync(1_200);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
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

    expect(deps.addShoppingListItem).toHaveBeenCalledWith({ foodId: 'food-1', quantity: 1 });
    expect(result.shoppingList).toEqual({ itemId: 'item-9', quantity: 2 });
    expect(result.stock).toEqual({ before: 3, after: 3 });
  });

  it('add_to_shopping_list falls back to the grocy product ref without a mapping', async () => {
    const deps = createDeps();

    await performDeviceAction({ productId: 42, action: 'add_to_shopping_list' }, deps);

    expect(deps.addShoppingListItem).toHaveBeenCalledWith({
      query: 'grocy:42',
      quantity: 1,
    });
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

  it('rejects an empty query', async () => {
    await expect(searchDeviceProducts({ query: '   ' }, createDeps()))
      .rejects.toThrow('Query must not be empty.');
  });
});

describe('createDeviceProduct', () => {
  it('creates the product, links the barcode and returns the product', async () => {
    const deps = createDeps({
      getProductDetails: vi.fn().mockResolvedValue(
        productDetails({ id: 99, name: 'New Product', stock: 0, opened: 0, min: 0 }),
      ),
    });

    const product = await createDeviceProduct(
      { name: ' New Product ', barcode: '4006381333931' },
      deps,
    );

    expect(deps.createProductInGrocy).toHaveBeenCalledWith({ name: 'New Product', grocyUnitId: 7 });
    expect(deps.createProductBarcode).toHaveBeenCalledWith({
      product_id: 99,
      barcode: '4006381333931',
    });
    expect(product).toMatchObject({ id: 99, name: 'New Product', stockAmount: 0 });
  });

  it('reports a duplicate name as a conflict with the existing product', async () => {
    const deps = createDeps({
      createProductInGrocy: vi.fn().mockResolvedValue({
        created: false,
        grocyProductId: 42,
        grocyProductName: 'Heinz Tomato Ketchup',
        duplicateCheck: { skipped: true, exactGrocyMatches: 1 },
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

  it('falls back to the first Grocy unit when no default unit is configured', async () => {
    const deps = createDeps({
      resolveDefaultGrocyUnitId: vi.fn().mockResolvedValue(null),
      listGrocyUnits: vi.fn().mockResolvedValue([{ id: 3, name: 'Piece' }]),
    });

    await createDeviceProduct({ name: 'New Product', barcode: '4006381333931' }, deps);

    expect(deps.createProductInGrocy).toHaveBeenCalledWith({ name: 'New Product', grocyUnitId: 3 });
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
    expect(product).toMatchObject({ id: 42, name: 'Heinz Tomato Ketchup' });
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
    });

    const product = await getDeviceProduct(43, deps);

    expect(deps.getProductDetails).toHaveBeenCalledWith(43);
    expect(product).toMatchObject({
      id: 43,
      name: 'Whole Milk',
      quantityUnit: 'Carton',
      stockAmount: 5,
      openedAmount: 2,
      minStockAmount: 1,
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
