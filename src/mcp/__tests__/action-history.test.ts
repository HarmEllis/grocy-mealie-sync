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
import type { InventoryMcpServices, ProductMcpServices } from '../contracts';
import {
  createHistoryWrappedInventoryServices,
  createHistoryWrappedProductServices,
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

  it('records MCP inventory mutations in history and logs them once', async () => {
    const baseServices = createBaseInventoryServices();
    const services = createHistoryWrappedInventoryServices(baseServices);

    const result = await services.addStock({
      productRef: 'mapping:map-1',
      amount: 2,
      bestBeforeDate: '2026-04-01',
    });

    expect(result.name).toBe('Milk');
    expect(baseServices.addStock).toHaveBeenCalledWith({
      productRef: 'mapping:map-1',
      amount: 2,
      bestBeforeDate: '2026-04-01',
    });
    expect(info).toHaveBeenCalledWith('[MCP] Added stock for "Milk": 2.');
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_add_stock',
      status: 'success',
      message: 'Added 2 stock to Grocy product "Milk".',
      summary: expect.objectContaining({
        productRef: 'mapping:map-1',
        grocyProductId: 101,
        name: 'Milk',
        amount: 2,
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
});
