import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: { __table: 'product_mappings' },
  unitMappingsTable: { __table: 'unit_mappings' },
  productMappingsRows: [] as Array<Record<string, unknown>>,
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  currentStock: [] as Array<Record<string, unknown>>,
  volatileStock: { missing_products: [] as Array<Record<string, unknown>> },
  updateGrocyEntity: vi.fn(),
  resolveMappingWizardMinStockStep: vi.fn(async () => '1'),
  logError: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  productMappings: mockState.productMappingsTable,
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn((selection?: unknown) => ({
      from: vi.fn(async (table: unknown) => {
        if (table === mockState.productMappingsTable) {
          if (selection && typeof selection === 'object') {
            return mockState.productMappingsRows;
          }
          return mockState.productMappingsRows;
        }
        if (table === mockState.unitMappingsTable) {
          return mockState.unitMappingsRows;
        }
        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'products') return mockState.grocyProducts;
    if (entity === 'quantity_units') return mockState.grocyUnits;
    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
  getCurrentStock: vi.fn(async () => mockState.currentStock),
  getVolatileStock: vi.fn(async () => mockState.volatileStock),
  updateGrocyEntity: mockState.updateGrocyEntity,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
  },
}));

vi.mock('@/lib/settings', () => ({
  resolveMappingWizardMinStockStep: mockState.resolveMappingWizardMinStockStep,
}));

import { GET, PATCH } from '../products/mapped/route';

describe('mapped products route', () => {
  beforeEach(() => {
    mockState.productMappingsRows = [];
    mockState.unitMappingsRows = [];
    mockState.grocyProducts = [];
    mockState.grocyUnits = [];
    mockState.currentStock = [];
    mockState.volatileStock = { missing_products: [] };
    mockState.updateGrocyEntity.mockReset();
    mockState.resolveMappingWizardMinStockStep.mockReset();
    mockState.resolveMappingWizardMinStockStep.mockResolvedValue('1');
    mockState.logError.mockClear();
  });

  it('returns mapped products with stock, units, and minimum stock', async () => {
    mockState.productMappingsRows = [
      {
        id: 'mapping-1',
        mealieFoodName: 'Rice',
        grocyProductId: 10,
        grocyProductName: 'Rice',
        unitMappingId: 'unit-map-1',
      },
      {
        id: 'mapping-2',
        mealieFoodName: 'Salt',
        grocyProductId: 11,
        grocyProductName: 'Salt',
        unitMappingId: null,
      },
    ];
    mockState.unitMappingsRows = [
      { id: 'unit-map-1', mealieUnitName: 'kilogram', grocyUnitName: 'kilogram' },
    ];
    mockState.grocyProducts = [
      { id: 10, name: 'Rice', qu_id_purchase: 5, min_stock_amount: 2 },
      { id: 11, name: 'Salt', qu_id_purchase: 6, min_stock_amount: 1 },
    ];
    mockState.grocyUnits = [
      { id: 5, name: 'kilogram' },
      { id: 6, name: 'pack' },
    ];
    mockState.currentStock = [
      { product_id: 10, amount: 1.5, amount_aggregated: 1.5 },
    ];
    mockState.volatileStock = {
      missing_products: [
        { id: 10 },
        { id: 11 },
      ],
    };

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      mappedProducts: [
        {
          id: 'mapping-1',
          grocyProductId: 10,
          name: 'Rice',
          unitName: 'kilogram',
          currentStock: 1.5,
          minStockAmount: 2,
          isBelowMinimum: true,
        },
        {
          id: 'mapping-2',
          grocyProductId: 11,
          name: 'Salt',
          unitName: 'pack',
          currentStock: 0,
          minStockAmount: 1,
          isBelowMinimum: true,
        },
      ],
      minStockStep: '1',
    });
  });

  it('marks mapped products as below minimum based on Grocy volatile stock', async () => {
    mockState.productMappingsRows = [
      {
        id: 'mapping-1',
        mealieFoodName: 'Pandan rijst',
        grocyProductId: 66,
        grocyProductName: 'Pandan rijst',
        unitMappingId: null,
      },
    ];
    mockState.grocyProducts = [
      { id: 66, name: 'Pandan rijst', qu_id_purchase: 6, min_stock_amount: 1 },
    ];
    mockState.grocyUnits = [
      { id: 6, name: 'bag' },
    ];
    mockState.currentStock = [
      { product_id: 66, amount: 1, amount_aggregated: 1 },
    ];
    mockState.volatileStock = {
      missing_products: [
        { id: 66 },
      ],
    };

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mappedProducts).toEqual([
      {
        id: 'mapping-1',
        grocyProductId: 66,
        name: 'Pandan rijst',
        unitName: 'bag',
        currentStock: 1,
        minStockAmount: 1,
        isBelowMinimum: true,
      },
    ]);
  });

  it('updates the Grocy minimum stock amount', async () => {
    const request = new Request('http://localhost/api/mapping-wizard/products/mapped', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grocyProductId: 10,
        minStockAmount: 3,
      }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('products', 10, {
      min_stock_amount: 3,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      grocyProductId: 10,
      minStockAmount: 3,
    });
  });

  it('accepts decimal minimum stock regardless of configured input step', async () => {
    mockState.resolveMappingWizardMinStockStep.mockResolvedValue('1');
    const request = new Request('http://localhost/api/mapping-wizard/products/mapped', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grocyProductId: 10,
        minStockAmount: 1.5,
      }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(mockState.updateGrocyEntity).toHaveBeenCalledWith('products', 10, {
      min_stock_amount: 1.5,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      grocyProductId: 10,
      minStockAmount: 1.5,
    });
  });
});
