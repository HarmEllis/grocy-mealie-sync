import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  recordHistoryRun,
  info,
  warn,
  error,
} = vi.hoisted(() => ({
  recordHistoryRun: vi.fn(async () => undefined),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/history-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/history-store')>('@/lib/history-store');

  return {
    ...actual,
    recordHistoryRun,
  };
});

vi.mock('@/lib/logger', () => ({
  log: {
    info,
    warn,
    error,
  },
}));

import { createManualHistoryRecorder } from '@/lib/manual-action-history';
import type {
  InventoryMcpServices,
  MappingMcpServices,
  ProductMcpServices,
  ShoppingMcpServices,
  UnitMcpServices,
} from '../contracts';
import {
  createHistoryWrappedInventoryServices,
  createHistoryWrappedMappingServices,
  createHistoryWrappedProductServices,
  createHistoryWrappedShoppingServices,
  createHistoryWrappedUnitServices,
} from '../action-history';

describe('manual action history helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records success outcomes with the existing console logging style', async () => {
    const history = createManualHistoryRecorder(
      'settings_update',
      '[History] Failed to record settings update:',
    );

    await history.recordSuccess({
      logMessage: '[Settings] Updated 2 setting(s).',
      message: 'Updated 2 setting(s).',
      summary: { updatedFields: ['autoCreateProducts', 'autoCreateUnits'] },
      events: [
        {
          level: 'info',
          category: 'system',
          entityKind: 'system',
          entityRef: 'settings',
          message: 'Updated settings.',
        },
      ],
    });

    expect(info).toHaveBeenCalledWith('[Settings] Updated 2 setting(s).');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'settings_update',
      status: 'success',
      message: 'Updated 2 setting(s).',
      summary: { updatedFields: ['autoCreateProducts', 'autoCreateUnits'] },
      events: [
        expect.objectContaining({
          level: 'info',
          category: 'system',
          entityKind: 'system',
          entityRef: 'settings',
          message: 'Updated settings.',
        }),
      ],
    }));
  });
});

describe('MCP action history wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createBaseInventoryServices(): InventoryMcpServices {
    return {
      getInventoryStock: vi.fn(),
      listLowStockProductsResource: vi.fn(),
      addStock: vi.fn(async () => ({
        productRef: 'mapping:map-1',
        grocyProductId: 101,
        name: 'Milk',
        amount: 2,
        openedAmount: 1,
        bestBeforeDate: '2026-04-01',
        note: null,
      })),
      consumeStock: vi.fn(),
      setStock: vi.fn(),
      markStockOpened: vi.fn(),
    };
  }

  function createBaseProductServices(): ProductMcpServices {
    return {
      searchProducts: vi.fn(),
      getProductOverview: vi.fn(),
      checkProductDuplicates: vi.fn(),
      updateGrocyStockSettings: vi.fn(),
      createProductInGrocy: vi.fn(async () => ({
        created: false,
        grocyProductId: null,
        grocyProductName: null,
        duplicateCheck: {
          skipped: true,
          exactGrocyMatches: 1,
        },
      })),
      createProductInMealie: vi.fn(),
      createProductInBoth: vi.fn(),
      updateBasicProduct: vi.fn(),
    };
  }

  function createBaseShoppingServices(): ShoppingMcpServices {
    return {
      getShoppingListItemsResource: vi.fn(),
      checkShoppingListProduct: vi.fn(),
      addShoppingListItem: vi.fn(async (): Promise<any> => ({
        action: 'created',
        item: {
          id: 'item-1',
          foodName: 'Milk',
          display: null,
        },
      })),
      addShoppingListItemByName: vi.fn(async (): Promise<any> => ({
        action: 'created',
        item: {
          id: 'item-2',
          foodName: 'Kwark',
          display: null,
        },
        resolved: {
          query: 'vanille kwark',
          matchedQuery: 'kwark',
          resolution: 'suffix_note',
          productRef: 'mapping:kwark-map',
          foodId: 'food-kwark',
          foodName: 'Kwark',
          derivedNote: 'vanille',
          note: 'vanille',
        },
      })),
      updateShoppingListItem: vi.fn(async (): Promise<any> => ({
        item: {
          id: 'item-1',
          foodName: 'Milk',
          display: null,
          quantity: 3,
        },
        updated: {
          quantity: 3,
        },
      })),
      removeShoppingListItem: vi.fn(async (): Promise<any> => ({
        itemId: 'item-1',
      })),
      mergeShoppingListDuplicates: vi.fn(async (): Promise<any> => ({
        merged: true,
        keptItemId: 'item-1',
        removedItemIds: ['item-2'],
      })),
    };
  }

  function createBaseMappingServices(): MappingMcpServices {
    return {
      listProductMappingsResource: vi.fn(),
      listUnitMappingsResource: vi.fn(),
      listUnmappedProductsResource: vi.fn(),
      listUnmappedUnitsResource: vi.fn(),
      suggestProductMappings: vi.fn(),
      suggestUnitMappings: vi.fn(),
      upsertProductMapping: vi.fn(async (): Promise<any> => ({
        mappingId: 'map-1',
        mealieFoodName: 'Milk',
        grocyProductName: 'Melk',
      })),
      removeProductMapping: vi.fn(async (): Promise<any> => ({
        mappingId: 'map-1',
      })),
      upsertUnitMapping: vi.fn(async (): Promise<any> => ({
        mappingId: 'unit-map-1',
        mealieUnitName: 'cup',
        grocyUnitName: 'kop',
      })),
      removeUnitMapping: vi.fn(async (): Promise<any> => ({
        mappingId: 'unit-map-1',
      })),
    };
  }

  function createBaseUnitServices(): UnitMcpServices {
    return {
      getUnitCatalog: vi.fn(),
      createGrocyUnit: vi.fn(async (): Promise<any> => ({
        created: true,
        grocyUnitId: 10,
        grocyUnitName: 'Gram',
      })),
      createMealieUnit: vi.fn(async (): Promise<any> => ({
        created: false,
        mealieUnitId: 'unit-1',
        mealieUnitName: 'Cup',
      })),
      compareUnits: vi.fn(),
      normalizeMappedUnits: vi.fn(async (): Promise<any> => ({
        normalizedMealie: 2,
        normalizedGrocy: 1,
      })),
      updateGrocyUnitMetadata: vi.fn(async (): Promise<any> => ({
        grocyUnitId: 10,
        name: 'Gram',
      })),
      updateMealieUnitMetadata: vi.fn(async (): Promise<any> => ({
        mealieUnitId: 'unit-1',
        name: 'Cup',
      })),
    };
  }

  it('records MCP inventory mutations in history and logs them once', async () => {
    const baseServices = createBaseInventoryServices();
    const services = createHistoryWrappedInventoryServices(baseServices);

    const result = await services.addStock({
      productRef: 'mapping:map-1',
      amount: 2,
      openedAmount: 1,
      bestBeforeDate: '2026-04-01',
    });

    expect(result.name).toBe('Milk');
    expect(baseServices.addStock).toHaveBeenCalledWith({
      productRef: 'mapping:map-1',
      amount: 2,
      openedAmount: 1,
      bestBeforeDate: '2026-04-01',
    });
    expect(info).toHaveBeenCalledWith('[MCP] Added stock for "Milk": 2 (1 opened).');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_add_stock',
      status: 'success',
      message: 'Added 2 stock to Grocy product "Milk", with 1 marked opened.',
      summary: expect.objectContaining({
        productRef: 'mapping:map-1',
        grocyProductId: 101,
        name: 'Milk',
        amount: 2,
        openedAmount: 1,
      }),
    }));
  });

  it('records duplicate-driven MCP product creation skips in history', async () => {
    const baseServices = createBaseProductServices();
    const services = createHistoryWrappedProductServices(baseServices);

    const result = await services.createProductInGrocy({
      name: 'Milk',
      grocyUnitId: 10,
    });

    expect(result.created).toBe(false);
    expect(info).toHaveBeenCalledWith(
      '[MCP] Skipped Grocy product creation for "Milk" because an exact duplicate already exists.',
    );
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_product_create',
      status: 'skipped',
      message: 'Skipped Grocy product creation for "Milk" because an exact duplicate already exists.',
    }));
  });

  it('falls back to the product ref when basic product updates lack resolved names', async () => {
    const baseServices = createBaseProductServices();
    baseServices.updateBasicProduct = vi.fn(async (): Promise<any> => ({
      productRef: 'mapping:map-1',
      grocyProductId: null,
      updated: {
        grocyName: null,
        mealieName: null,
      },
    }));
    const services = createHistoryWrappedProductServices(baseServices);

    await services.updateBasicProduct({
      productRef: 'mapping:map-1',
    } as any);

    expect(info).toHaveBeenCalledWith('[MCP] Updated basic product metadata for "mapping:map-1".');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'product_update_basic',
      events: [
        expect.objectContaining({
          entityRef: 'mapping:map-1',
          message: 'Updated basic product metadata for "mapping:map-1".',
        }),
      ],
    }));
  });

  it('records MCP mutation failures in history and logs the error once', async () => {
    const baseServices = createBaseInventoryServices();
    const failingError = new Error('Grocy is unavailable.');
    baseServices.addStock = vi.fn(async () => {
      throw failingError;
    });
    const services = createHistoryWrappedInventoryServices(baseServices);

    await expect(services.addStock({
      productRef: 'mapping:map-1',
      amount: 2,
    })).rejects.toThrow('Grocy is unavailable.');

    expect(error).toHaveBeenCalledWith('[MCP] Add stock failed:', failingError);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_add_stock',
      status: 'failure',
      message: 'Adding stock failed: Grocy is unavailable.',
      summary: {
        productRef: 'mapping:map-1',
        amount: 2,
        error: 'Grocy is unavailable.',
      },
    }));
  });

  it('records inventory failures with default boolean flags for omitted params', async () => {
    const baseServices = createBaseInventoryServices();
    const failingError = new Error('Inventory service timed out.');
    baseServices.consumeStock = vi.fn(async () => {
      throw failingError;
    });
    const services = createHistoryWrappedInventoryServices(baseServices);

    await expect(services.consumeStock({
      productRef: 'mapping:map-1',
      amount: 1,
    } as any)).rejects.toThrow('Inventory service timed out.');

    expect(error).toHaveBeenCalledWith('[MCP] Consume stock failed:', failingError);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_consume_stock',
      status: 'failure',
      summary: {
        productRef: 'mapping:map-1',
        amount: 1,
        spoiled: false,
        exactAmount: false,
        error: 'Inventory service timed out.',
      },
    }));
  });

  it('defaults mark-opened failures to one item when the amount is omitted', async () => {
    const baseServices = createBaseInventoryServices();
    const failingError = new Error('No unopened stock entries remain.');
    baseServices.markStockOpened = vi.fn(async () => {
      throw failingError;
    });
    const services = createHistoryWrappedInventoryServices(baseServices);

    await expect(services.markStockOpened({
      productRef: 'mapping:map-1',
    } as any)).rejects.toThrow('No unopened stock entries remain.');

    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_mark_opened',
      status: 'failure',
      summary: {
        productRef: 'mapping:map-1',
        amount: 1,
        error: 'No unopened stock entries remain.',
      },
    }));
  });

  it('records shopping list merges using the fallback display label', async () => {
    const baseServices = createBaseShoppingServices();
    baseServices.addShoppingListItem = vi.fn(async (): Promise<any> => ({
      action: 'updated',
      item: {
        id: 'item-1',
        foodName: null,
        display: 'Whole Milk',
      },
    }));
    const services = createHistoryWrappedShoppingServices(baseServices);

    await services.addShoppingListItem({
      foodId: 'food-1',
      quantity: 2,
    } as any);

    expect(info).toHaveBeenCalledWith('[MCP] Merged shopping list item for "Whole Milk".');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'shopping_add_item',
      message: 'Merged into an existing shopping list item for "Whole Milk".',
      events: [
        expect.objectContaining({
          entityRef: 'item-1',
        }),
      ],
    }));
  });

  it('records shopping item adds-by-name with the resolved item label', async () => {
    const baseServices = createBaseShoppingServices();
    const services = createHistoryWrappedShoppingServices(baseServices);

    await services.addShoppingListItemByName({
      query: 'vanille kwark',
      quantity: 1,
    } as any);

    expect(info).toHaveBeenCalledWith('[MCP] Added shopping list item for "Kwark".');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'shopping_add_item',
      message: 'Added a shopping list item for "Kwark".',
      events: [
        expect.objectContaining({
          entityRef: 'item-2',
        }),
      ],
    }));
  });

  it('records skipped shopping duplicate merges distinctly from successful mutations', async () => {
    const baseServices = createBaseShoppingServices();
    baseServices.mergeShoppingListDuplicates = vi.fn(async (): Promise<any> => ({
      merged: false,
      keptItemId: 'item-1',
      removedItemIds: [],
    }));
    const services = createHistoryWrappedShoppingServices(baseServices);

    const result = await services.mergeShoppingListDuplicates({
      foodId: 'food-1',
    } as any);

    expect(result.merged).toBe(false);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'shopping_merge_duplicates',
      status: 'skipped',
      message: 'No duplicate shopping list items needed merging for food food-1.',
    }));
  });

  it('records shopping item updates with quantity-specific messages', async () => {
    const baseServices = createBaseShoppingServices();
    const services = createHistoryWrappedShoppingServices(baseServices);

    await services.updateShoppingListItem({
      itemId: 'item-1',
      quantity: 3,
    } as any);

    expect(info).toHaveBeenCalledWith('[MCP] Updated quantity for shopping list item "Milk" to 3.');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'shopping_update_item',
      status: 'success',
      message: 'Updated quantity for shopping list item "Milk" to 3.',
    }));
  });

  it('records mapping upsert failures with a mealie id fallback when no mapping id exists', async () => {
    const baseServices = createBaseMappingServices();
    const failingError = new Error('Unit mismatch.');
    baseServices.upsertProductMapping = vi.fn(async () => {
      throw failingError;
    });
    const services = createHistoryWrappedMappingServices(baseServices);

    await expect(services.upsertProductMapping({
      mealieFoodId: 'food-1',
      grocyProductId: 101,
    } as any)).rejects.toThrow('Unit mismatch.');

    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_product_sync',
      status: 'failure',
      summary: {
        mealieFoodId: 'food-1',
        grocyProductId: 101,
        error: 'Unit mismatch.',
      },
      events: [
        expect.objectContaining({
          entityRef: 'food-1',
          details: {
            mealieFoodId: 'food-1',
            grocyProductId: 101,
            grocyUnitId: null,
            error: 'Unit mismatch.',
          },
        }),
      ],
    }));
  });

  it('records unit mapping removals as successful history runs', async () => {
    const baseServices = createBaseMappingServices();
    const services = createHistoryWrappedMappingServices(baseServices);

    await services.removeUnitMapping({
      mappingId: 'unit-map-1',
    } as any);

    expect(info).toHaveBeenCalledWith('[MCP] Removed unit mapping unit-map-1.');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_unit_unmap',
      status: 'success',
      message: 'Removed unit mapping unit-map-1.',
    }));
  });

  it('records no-arg unit normalization runs', async () => {
    const baseServices = createBaseUnitServices();
    const services = createHistoryWrappedUnitServices(baseServices);

    const result = await services.normalizeMappedUnits();

    expect(result).toEqual({ normalizedMealie: 2, normalizedGrocy: 1 });
    expect(info).toHaveBeenCalledWith('[MCP] Units normalized: Mealie 2, Grocy 1.');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_unit_normalize',
      status: 'success',
      message: 'Normalized 2 Mealie and 1 Grocy unit name(s).',
    }));
  });

  it('records skipped Mealie unit creations distinctly from successful mutations', async () => {
    const baseServices = createBaseUnitServices();
    const services = createHistoryWrappedUnitServices(baseServices);

    const result = await services.createMealieUnit({
      name: 'Cup',
    } as any);

    expect(result.created).toBe(false);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_unit_create_mealie',
      status: 'skipped',
      message: 'Skipped Mealie unit creation for "Cup" because an exact duplicate already exists.',
    }));
  });

  it('records Mealie unit update failures with the Mealie unit id as the entity ref', async () => {
    const baseServices = createBaseUnitServices();
    const failingError = new Error('Mealie rejected the update.');
    baseServices.updateMealieUnitMetadata = vi.fn(async () => {
      throw failingError;
    });
    const services = createHistoryWrappedUnitServices(baseServices);

    await expect(services.updateMealieUnitMetadata({
      mealieUnitId: 'unit-1',
    } as any)).rejects.toThrow('Mealie rejected the update.');

    expect(error).toHaveBeenCalledWith('[MCP] Update Mealie unit failed:', failingError);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'unit_update_mealie',
      status: 'failure',
      summary: {
        mealieUnitId: 'unit-1',
        error: 'Mealie rejected the update.',
      },
      events: [
        expect.objectContaining({
          entityRef: 'unit-1',
          message: 'Updating the Mealie unit failed.',
        }),
      ],
    }));
  });
});
