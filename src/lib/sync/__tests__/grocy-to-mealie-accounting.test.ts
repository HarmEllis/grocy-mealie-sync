import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productMappings } from '../../db/schema';
import { mockMealieShoppingItem,
  mockUnitMapping, mockMissingProduct, mockProductMapping, mockSyncState } from './helpers/mocks';

// Receipt bookings must reduce the Mealie list exactly once: the reconciler
// reduces the row, and the next low-stock poll must not reduce it again, while
// unrelated stock changes in the same interval still produce their deltas.

const mockLimit = vi.fn<(...args: any[]) => any>();
const mockWhere = vi.fn<(...args: any[]) => any>(() => ({ limit: mockLimit }));
const mockFrom = vi.fn<(...args: any[]) => any>(() => ({ where: mockWhere }));
const mockSelect = vi.fn<(...args: any[]) => any>(() => ({ from: mockFrom }));

vi.mock('../../db', () => ({ db: { select: (...args: any[]) => mockSelect(...args) } }));
vi.mock('../../grocy/types', () => ({ getVolatileStock: vi.fn(), getGrocyEntities: vi.fn(), getCurrentStock: vi.fn() }));
vi.mock('../../mealie', () => ({
  HouseholdsShoppingListItemsService: {
    createOneApiHouseholdsShoppingItemsPost: vi.fn(),
    updateOneApiHouseholdsShoppingItemsItemIdPut: vi.fn(),
    deleteOneApiHouseholdsShoppingItemsItemIdDelete: vi.fn(),
  },
}));
vi.mock('../../settings', () => ({
  resolveShoppingListId: vi.fn(),
  resolveEnsureLowStockOnMealieList: vi.fn(),
  resolveSyncSubProducts: vi.fn(),
  resolveSyncParentOwnStock: vi.fn(),
}));
vi.mock('../../shop/low-stock-accounting', () => ({ loadLowStockAdjustments: vi.fn() }));
vi.mock('../state', () => ({ getSyncState: vi.fn(), saveSyncState: vi.fn(), saveSyncStateConsumingRestocks: vi.fn() }));
vi.mock('../helpers', () => ({ fetchAllMealieShoppingItems: vi.fn() }));
vi.mock('../mealie-in-possession', () => ({
  syncMealieInPossessionFromGrocy: vi.fn(async () => ({ status: 'skipped', reason: 'disabled', summary: {} })),
}));
vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { pollGrocyForMissingStock } from '../grocy-to-mealie';
import { getCurrentStock, getGrocyEntities, getVolatileStock } from '../../grocy/types';
import { HouseholdsShoppingListItemsService } from '../../mealie';
import { resolveEnsureLowStockOnMealieList, resolveShoppingListId, resolveSyncParentOwnStock, resolveSyncSubProducts } from '../../settings';
import { loadLowStockAdjustments } from '../../shop/low-stock-accounting';
import { getSyncState, saveSyncState, saveSyncStateConsumingRestocks } from '../state';
import { fetchAllMealieShoppingItems } from '../helpers';

const mockedUpdate = vi.mocked(HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut);
const mockedDelete = vi.mocked(HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete);
const mockedCreate = vi.mocked(HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost);
const mockedAdjustments = vi.mocked(loadLowStockAdjustments);
const mockedConsumingSave = vi.mocked(saveSyncStateConsumingRestocks);

function restock(grocyProductId: number, stockAmount: number, effectId = `effect-${grocyProductId}`) {
  return { effectId, grocyProductId, stockAmount };
}

function setAdjustments(accounted: ReturnType<typeof restock>[], frozen: number[] = []) {
  mockedAdjustments.mockReturnValue({ accounted, frozenProductIds: new Set(frozen) });
}

function savedState() {
  const call = mockedConsumingSave.mock.calls.at(-1) ?? vi.mocked(saveSyncState).mock.calls.at(-1);
  return call![0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveShoppingListId).mockResolvedValue('list-1');
  vi.mocked(resolveEnsureLowStockOnMealieList).mockResolvedValue(false);
  vi.mocked(resolveSyncSubProducts).mockResolvedValue(false);
  vi.mocked(resolveSyncParentOwnStock).mockResolvedValue(false);
  vi.mocked(getCurrentStock).mockResolvedValue([]);
  vi.mocked(getGrocyEntities).mockResolvedValue([
    { id: 101, name: 'Milk', qu_id_purchase: 10, qu_id_stock: 10 },
    { id: 201, name: 'Oat milk', qu_id_purchase: 10, qu_id_stock: 10, parent_product_id: 101 },
  ] as any);
  vi.mocked(fetchAllMealieShoppingItems).mockResolvedValue([mockMealieShoppingItem({ id: 'row', quantity: 5 })]);
  setAdjustments([]);
  mockFrom.mockImplementation((table: unknown) => {
    mockWhere.mockImplementation(() => {
      mockLimit.mockImplementation(() => Promise.resolve(table === productMappings ? [mockProductMapping()] : []));
      return { limit: mockLimit };
    });
    return { where: mockWhere };
  });
});

describe('low-stock sync with receipt bookings', () => {
  it('does not reduce the row again after a partial receipt restock', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 5 } }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });
    setAdjustments([restock(101, 3)]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(mockedConsumingSave).toHaveBeenCalledWith(expect.anything(), ['effect-101']);
    expect(savedState().grocyBelowMinStock).toEqual({ 101: 2 });
  });

  it('keeps receipt restocks of a skipped product for its retry', async () => {
    const flour = (mapped: boolean) => {
      vi.mocked(getGrocyEntities).mockImplementation((async (entity: string) => entity === 'quantity_units'
        ? [{ id: 14, name: 'kilogram' }, { id: 9, name: 'zak' }]
        : [{ id: 101, name: 'Flour', qu_id_stock: 14, qu_id_purchase: 9 }]) as any);
      mockFrom.mockImplementation((table: unknown) => {
        mockWhere.mockImplementation(() => {
          mockLimit.mockImplementation(() => Promise.resolve(table === productMappings
            ? [mockProductMapping()]
            : mapped ? [mockUnitMapping({ grocyUnitId: 14, mealieUnitId: 'mealie-kg' })] : []));
          return { limit: mockLimit };
        });
        return { where: mockWhere };
      });
    };
    vi.mocked(fetchAllMealieShoppingItems).mockResolvedValue([mockMealieShoppingItem({ id: 'row', unitId: 'mealie-kg', quantity: 10 })]);
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 7 })] });
    setAdjustments([restock(101, 2)]);

    // Poll 1: kilogram has no Mealie unit, so nothing is written or consumed.
    flour(false);
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 10 } }));
    await pollGrocyForMissingStock();
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedConsumingSave).not.toHaveBeenCalled();
    expect(savedState().grocyBelowMinStock).toEqual({ 101: 10 });

    // Poll 2: kilogram is mapped; the receipt's 2 is subtracted once: 10 - 2 -> 7 is -1.
    flour(true);
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 10 } }));
    await pollGrocyForMissingStock();
    expect(mockedUpdate).toHaveBeenCalledWith('row', expect.objectContaining({ quantity: 9 }));
    expect(mockedConsumingSave).toHaveBeenCalledWith(expect.anything(), ['effect-101']);
  });

  it('is a no-op when the receipt covered the whole previous shortage', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 5 } }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [] });
    setAdjustments([restock(101, 5)]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('treats extras beyond the shortage like a full restock', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 2 } }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [] });
    setAdjustments([restock(101, 6)]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('still applies an unrelated manual restock in the same interval', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 5 } }));
    // Receipt booked 2, the user added 1 by hand: shortage 5 -> 2.
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });
    setAdjustments([restock(101, 2)]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).toHaveBeenCalledWith('row', expect.objectContaining({ quantity: 4 }));
  });

  it('still adds a new shortage that appears after the receipt', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 2 } }));
    // Receipt booked 2 (shortage gone), then consumption made 1 missing again.
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 1 })] });
    setAdjustments([restock(101, 2)]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).toHaveBeenCalledWith('row', expect.objectContaining({ quantity: 6 }));
  });

  it('accounts a child booking against its aggregated parent', async () => {
    vi.mocked(resolveSyncSubProducts).mockResolvedValue(true);
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({
      grocyBelowMinStock: { 201: 4 },
      grocyEffectiveParentByOriginalId: { 201: 101 },
    }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 201, name: 'Oat milk', amount_missing: 1 })] });
    setAdjustments([restock(201, 3)]);

    await pollGrocyForMissingStock();

    // Only metadata may be refreshed; the quantity stays at the receipt-reduced value.
    for (const call of mockedUpdate.mock.calls) expect(call[1]).toMatchObject({ quantity: 5 });
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('accounts a parent own-stock deficit restocked by a receipt', async () => {
    vi.mocked(resolveSyncSubProducts).mockResolvedValue(true);
    vi.mocked(resolveSyncParentOwnStock).mockResolvedValue(true);
    vi.mocked(getGrocyEntities).mockResolvedValue([
      { id: 101, name: 'Milk', qu_id_purchase: 10, qu_id_stock: 10, min_stock_amount: 4 },
      { id: 201, name: 'Oat milk', qu_id_purchase: 10, qu_id_stock: 10, parent_product_id: 101 },
    ] as any);
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({
      grocyBelowMinStock: {},
      grocyEffectiveParentByOriginalId: { 201: 101 },
      grocyParentOwnStockDeficit: { 101: 3 },
    }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [] });
    vi.mocked(getCurrentStock).mockResolvedValue([{ product_id: 101, amount: 4 }] as any);
    setAdjustments([restock(101, 3)]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('freezes a product while its booking outcome is unknown and keeps the previous snapshot', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 5 } }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });
    setAdjustments([restock(101, 3)], [101]);

    await pollGrocyForMissingStock();

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
    // Not consumed: it is applied once the outcome is settled.
    expect(mockedConsumingSave).not.toHaveBeenCalled();
    expect(savedState().grocyBelowMinStock).toEqual({ 101: 5 });
  });

  it('keeps the existing behaviour when there are no shop bookings', async () => {
    vi.mocked(getSyncState).mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 5 } }));
    vi.mocked(getVolatileStock).mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });

    await pollGrocyForMissingStock();

    expect(mockedUpdate).toHaveBeenCalledWith('row', expect.objectContaining({ quantity: 2 }));
    expect(mockedConsumingSave).not.toHaveBeenCalled();
    expect(vi.mocked(saveSyncState)).toHaveBeenCalled();
  });
});
