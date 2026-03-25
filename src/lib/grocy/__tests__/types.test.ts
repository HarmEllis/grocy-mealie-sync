import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  getObject: vi.fn(),
  putObject: vi.fn(),
}));

vi.mock('../init', () => ({}));

vi.mock('../client', () => ({
  GenericEntityInteractionsService: {
    getObjects1: mockState.getObject,
    putObjects: mockState.putObject,
  },
  StockService: {},
}));

import { updateGrocyEntity } from '../types';

describe('updateGrocyEntity', () => {
  beforeEach(() => {
    mockState.getObject.mockReset();
    mockState.putObject.mockReset();
  });

  it('merges partial product updates onto the current Grocy product before PUT', async () => {
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
    expect(mockState.putObject).toHaveBeenCalledWith('products', 101, {
      name: 'Gepelde tomaten',
      qu_id_purchase: 10,
      qu_id_stock: 10,
      min_stock_amount: 0,
      location_id: 1,
    });
  });
});
