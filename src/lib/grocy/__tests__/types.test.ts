import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  getObject: vi.fn(),
  putObject: vi.fn(),
  getStock: vi.fn(),
  getStockVolatile: vi.fn(),
}));

vi.mock('../init', () => ({}));

vi.mock('../client', () => ({
  GenericEntityInteractionsService: {
    getObjects1: mockState.getObject,
    putObjects: mockState.putObject,
  },
  StockService: {
    getStock: mockState.getStock,
    getStockVolatile: mockState.getStockVolatile,
  },
}));

import { getCurrentStock, getVolatileStock, updateGrocyEntity } from '../types';

describe('updateGrocyEntity', () => {
  beforeEach(() => {
    mockState.getObject.mockReset();
    mockState.putObject.mockReset();
  });

  it('merges the current editable product fields onto partial updates before PUT', async () => {
    mockState.getObject.mockResolvedValue({
      id: 101,
      name: 'Gezeefde tomaten',
      description: null,
      qu_id_purchase: 10,
      qu_id_stock: 10,
      min_stock_amount: 0,
      location_id: 1,
      shopping_location_id: null,
      row_created_timestamp: '2025-01-01 12:00:00',
      userfields: null,
    });
    mockState.putObject.mockResolvedValue(undefined);

    await updateGrocyEntity('products', 101, { name: 'Gepelde tomaten' });

    expect(mockState.getObject).toHaveBeenCalledWith('products', 101);
    expect(mockState.putObject).toHaveBeenCalledWith('products', 101, expect.objectContaining({
      name: 'Gepelde tomaten',
      description: null,
      qu_id_purchase: 10,
      qu_id_stock: 10,
      min_stock_amount: 0,
      location_id: 1,
      shopping_location_id: null,
    }));

    const payload = mockState.putObject.mock.calls[0]?.[2];
    expect(payload).not.toHaveProperty('row_created_timestamp');
    expect(payload).not.toHaveProperty('userfields');
  });
});

describe('getCurrentStock', () => {
  beforeEach(() => {
    mockState.getStock.mockReset();
  });

  it('returns the stock rows when Grocy answers with an array', async () => {
    mockState.getStock.mockResolvedValue([{ product_id: 1, amount: 3 }]);

    await expect(getCurrentStock()).resolves.toEqual([{ product_id: 1, amount: 3 }]);
  });

  it('throws a descriptive error when Grocy answers 200 with an error object', async () => {
    mockState.getStock.mockResolvedValue({ error_message: 'Something went wrong' });

    await expect(getCurrentStock()).rejects.toThrow(
      /Grocy \/stock returned an unexpected payload.*error_message/,
    );
  });

  it('throws instead of returning an empty list when Grocy answers with HTML', async () => {
    mockState.getStock.mockResolvedValue('<html><body>502 Bad Gateway</body></html>');

    await expect(getCurrentStock()).rejects.toThrow(/expected an array, got string/);
  });
});

describe('getVolatileStock', () => {
  beforeEach(() => {
    mockState.getStockVolatile.mockReset();
  });

  it('returns the volatile payload when Grocy answers with an object', async () => {
    mockState.getStockVolatile.mockResolvedValue({ missing_products: [{ id: 1, amount_missing: 2 }] });

    await expect(getVolatileStock()).resolves.toEqual({ missing_products: [{ id: 1, amount_missing: 2 }] });
  });

  it('throws instead of silently reporting no missing products on a non-object payload', async () => {
    mockState.getStockVolatile.mockResolvedValue('<html><body>502 Bad Gateway</body></html>');

    await expect(getVolatileStock()).rejects.toThrow(
      /Grocy \/stock\/volatile returned an unexpected payload/,
    );
  });
});
