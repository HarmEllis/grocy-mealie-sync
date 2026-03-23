import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockMealieShoppingItem,
  mockProductMapping,
  mockSyncState,
  mockGrocyShoppingItem,
} from './helpers/mocks';

// ---------------------------------------------------------------------------
// DB mock (drizzle query chain)
// Must use vi.hoisted() so the variables are available inside the hoisted
// vi.mock factory.
// ---------------------------------------------------------------------------
const { mockLimit, mockWhere, mockFrom, mockSelect } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return { mockLimit, mockWhere, mockFrom, mockSelect };
});

vi.mock('../../db', () => ({
  db: { select: mockSelect },
}));

// ---------------------------------------------------------------------------
// Grocy typed wrappers
// ---------------------------------------------------------------------------
vi.mock('../../grocy/types', () => ({
  getGrocyEntities: vi.fn(),
  deleteGrocyEntity: vi.fn(),
  getProductDetails: vi.fn(),
  addProductStock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
vi.mock('../../settings', () => ({
  resolveShoppingListId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------
vi.mock('../state', () => ({
  getSyncState: vi.fn(),
  saveSyncState: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
vi.mock('../helpers', () => ({
  fetchAllMealieShoppingItems: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Config (factory pattern so we can mutate per-test)
// ---------------------------------------------------------------------------
vi.mock('../../config', () => ({
  config: {
    stockOnlyMinStock: false,
  },
}));

// ---------------------------------------------------------------------------
// Logger (suppress output)
// ---------------------------------------------------------------------------
vi.mock('../../logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock so hoisting works)
// ---------------------------------------------------------------------------
import { pollMealieForCheckedItems } from '../mealie-to-grocy';
import { resolveShoppingListId } from '../../settings';
import { getSyncState, saveSyncState } from '../state';
import { fetchAllMealieShoppingItems } from '../helpers';
import {
  getGrocyEntities,
  deleteGrocyEntity,
  getProductDetails,
  addProductStock,
} from '../../grocy/types';
import { config } from '../../config';

// ---------------------------------------------------------------------------
// Typed mock accessors
// ---------------------------------------------------------------------------
const mockedResolveShoppingListId = vi.mocked(resolveShoppingListId);
const mockedGetSyncState = vi.mocked(getSyncState);
const mockedSaveSyncState = vi.mocked(saveSyncState);
const mockedFetchAll = vi.mocked(fetchAllMealieShoppingItems);
const mockedGetGrocyEntities = vi.mocked(getGrocyEntities);
const mockedDeleteGrocyEntity = vi.mocked(deleteGrocyEntity);
const mockedGetProductDetails = vi.mocked(getProductDetails);
const mockedAddProductStock = vi.mocked(addProductStock);

// ---------------------------------------------------------------------------
// Default setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.resetAllMocks();

  // Defaults: a valid shopping list, empty state, empty items
  mockedResolveShoppingListId.mockResolvedValue('list-1');
  mockedGetSyncState.mockResolvedValue(mockSyncState());
  mockedSaveSyncState.mockResolvedValue(undefined);
  mockedFetchAll.mockResolvedValue([]);
  mockedGetGrocyEntities.mockResolvedValue([]);
  mockedDeleteGrocyEntity.mockResolvedValue(undefined);
  mockedAddProductStock.mockResolvedValue(undefined);

  // DB: no mappings by default
  mockLimit.mockResolvedValue([]);

  // Reset config
  (config as any).stockOnlyMinStock = false;
});

// ===========================================================================
describe('pollMealieForCheckedItems', () => {
  // -------------------------------------------------------------------------
  // Happy paths
  // -------------------------------------------------------------------------

  it('adds stock, removes from Grocy list, and updates syncRestockedProducts for a newly checked item', async () => {
    const item = mockMealieShoppingItem({ id: 'item-1', checked: true, foodId: 'food-1', quantity: 1 });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101, grocyProductName: 'Milk' });
    const grocySi = mockGrocyShoppingItem({ id: 5, product_id: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([grocySi] as any);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
    expect(mockedDeleteGrocyEntity).toHaveBeenCalledWith('shopping_list', 5);

    // saveSyncState should have been called with syncRestockedProducts containing "101"
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.syncRestockedProducts).toHaveProperty('101');
    // The value should be an ISO timestamp string
    expect(savedState.syncRestockedProducts['101']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('processes multiple checked items in one poll and saves state once', async () => {
    const itemA = mockMealieShoppingItem({ id: 'a', checked: true, foodId: 'food-a' });
    const itemB = mockMealieShoppingItem({ id: 'b', checked: true, foodId: 'food-b' });
    const mappingA = mockProductMapping({ mealieFoodId: 'food-a', grocyProductId: 201, grocyProductName: 'Eggs' });
    const mappingB = mockProductMapping({ mealieFoodId: 'food-b', grocyProductId: 202, grocyProductName: 'Butter' });

    mockedFetchAll.mockResolvedValue([itemA, itemB]);
    // Return the correct mapping for each DB lookup
    mockLimit
      .mockResolvedValueOnce([mappingA])
      .mockResolvedValueOnce([mappingB]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledTimes(2);
    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 1);
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1);
    expect(mockedSaveSyncState).toHaveBeenCalledTimes(1);
  });

  it('uses item quantity from Mealie (quantity=3)', async () => {
    const item = mockMealieShoppingItem({ id: 'item-q', checked: true, foodId: 'food-1', quantity: 3 });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 3);
  });

  it('records ISO timestamp in syncRestockedProducts keyed by grocyProductId', async () => {
    const before = new Date();
    const item = mockMealieShoppingItem({ id: 'item-ts', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 777 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    const ts = savedState.syncRestockedProducts['777'];
    expect(ts).toBeDefined();
    // The timestamp should be on or after the time we captured before the call
    expect(new Date(ts).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  // -------------------------------------------------------------------------
  // Skip / No-Op
  // -------------------------------------------------------------------------

  it('skips poll when no shopping list is configured', async () => {
    mockedResolveShoppingListId.mockResolvedValue(null);

    await pollMealieForCheckedItems();

    expect(mockedFetchAll).not.toHaveBeenCalled();
    expect(mockedSaveSyncState).not.toHaveBeenCalled();
  });

  it('skips item without foodId (no mapping lookup, no stock add)', async () => {
    const item = mockMealieShoppingItem({ id: 'no-food', checked: true, foodId: null });

    mockedFetchAll.mockResolvedValue([item]);

    await pollMealieForCheckedItems();

    // No DB lookup should happen
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockedAddProductStock).not.toHaveBeenCalled();
    // State should still be saved (item is recorded in newCheckedState)
    expect(mockedSaveSyncState).toHaveBeenCalledTimes(1);
  });

  it('skips item when no mapping found for foodId', async () => {
    const item = mockMealieShoppingItem({ id: 'unmapped', checked: true, foodId: 'food-unknown' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([]); // no mapping

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    expect(mockedSaveSyncState).toHaveBeenCalledTimes(1);
  });

  it('does not reprocess already-checked items (was true, still true)', async () => {
    const item = mockMealieShoppingItem({ id: 'already', checked: true, foodId: 'food-1' });
    const state = mockSyncState({
      mealieCheckedItems: { already: true },
    });

    mockedFetchAll.mockResolvedValue([item]);
    mockedGetSyncState.mockResolvedValue(state);

    await pollMealieForCheckedItems();

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockedAddProductStock).not.toHaveBeenCalled();
  });

  it('takes no action when an item is unchecked (was true, now false)', async () => {
    const item = mockMealieShoppingItem({ id: 'unchecked', checked: false, foodId: 'food-1' });
    const state = mockSyncState({
      mealieCheckedItems: { unchecked: true },
    });

    mockedFetchAll.mockResolvedValue([item]);
    mockedGetSyncState.mockResolvedValue(state);

    await pollMealieForCheckedItems();

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockedAddProductStock).not.toHaveBeenCalled();
    // The unchecked state should be persisted as false
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedItems['unchecked']).toBe(false);
  });

  // -------------------------------------------------------------------------
  // STOCK_ONLY_MIN_STOCK
  // -------------------------------------------------------------------------

  it('proceeds when STOCK_ONLY_MIN_STOCK is true and min_stock_amount > 0', async () => {
    (config as any).stockOnlyMinStock = true;
    const item = mockMealieShoppingItem({ id: 'min-ok', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetProductDetails.mockResolvedValue({
      product: { min_stock_amount: 5 },
    } as any);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
  });

  it('skips when STOCK_ONLY_MIN_STOCK is true and min_stock_amount is 0', async () => {
    (config as any).stockOnlyMinStock = true;
    const item = mockMealieShoppingItem({ id: 'min-zero', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetProductDetails.mockResolvedValue({
      product: { min_stock_amount: 0 },
    } as any);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    // processCheckedItem returned null, so no syncRestockedProducts entry
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.syncRestockedProducts).toEqual({});
  });

  it('proceeds when getProductDetails throws (resilience)', async () => {
    (config as any).stockOnlyMinStock = true;
    const item = mockMealieShoppingItem({ id: 'details-err', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetProductDetails.mockRejectedValue(new Error('Grocy API timeout'));
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // Should still add stock despite getProductDetails failure
    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('removes item from newCheckedState for retry when addProductStock throws', async () => {
    const item = mockMealieShoppingItem({ id: 'fail-stock', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedAddProductStock.mockRejectedValue(new Error('Grocy 500'));

    await pollMealieForCheckedItems();

    // Item should NOT be in the saved checked state (deleted for retry)
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedItems).not.toHaveProperty('fail-stock');
  });

  it('still returns grocyProductId when deleteGrocyEntity throws (non-critical)', async () => {
    const item = mockMealieShoppingItem({ id: 'del-fail', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });
    const grocySi = mockGrocyShoppingItem({ id: 10, product_id: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([grocySi] as any);
    mockedDeleteGrocyEntity.mockRejectedValue(new Error('Delete failed'));

    await pollMealieForCheckedItems();

    // Stock was added
    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
    // Despite delete failure, syncRestockedProducts should still be updated
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.syncRestockedProducts).toHaveProperty('101');
    // Item is recorded as checked (not removed from newCheckedState)
    expect(savedState.mealieCheckedItems['del-fail']).toBe(true);
  });

  it('aborts poll gracefully when fetchAllMealieShoppingItems throws', async () => {
    mockedFetchAll.mockRejectedValue(new Error('Mealie unreachable'));

    await pollMealieForCheckedItems();

    // Should not crash, and state should NOT be saved (error caught at top level)
    expect(mockedSaveSyncState).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('coerces quantity=0 to 1 (falsy fallback)', async () => {
    const item = mockMealieShoppingItem({ id: 'qty-zero', checked: true, foodId: 'food-1', quantity: 0 });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // `item.quantity || 1` with quantity=0 yields 1
    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
  });

  it('deletes all matching Grocy shopping list items for the same product', async () => {
    const item = mockMealieShoppingItem({ id: 'multi-del', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });
    const grocySi1 = mockGrocyShoppingItem({ id: 20, product_id: 101 });
    const grocySi2 = mockGrocyShoppingItem({ id: 21, product_id: 101 });
    const grocySiOther = mockGrocyShoppingItem({ id: 22, product_id: 999 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([grocySi1, grocySi2, grocySiOther] as any);

    await pollMealieForCheckedItems();

    expect(mockedDeleteGrocyEntity).toHaveBeenCalledTimes(2);
    expect(mockedDeleteGrocyEntity).toHaveBeenCalledWith('shopping_list', 20);
    expect(mockedDeleteGrocyEntity).toHaveBeenCalledWith('shopping_list', 21);
    // Should NOT delete the unrelated item
    expect(mockedDeleteGrocyEntity).not.toHaveBeenCalledWith('shopping_list', 22);
  });

  it('treats pre-checked items on first poll (not in previousCheckedState) as newly checked', async () => {
    // previousCheckedState is empty (first poll)
    const item = mockMealieShoppingItem({ id: 'pre-checked', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockedGetSyncState.mockResolvedValue(mockSyncState({ mealieCheckedItems: {} }));
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // wasChecked is undefined, and checked is true => newly checked
    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
  });

  it('on partial failure, only the failed item is removed from newCheckedState', async () => {
    const itemA = mockMealieShoppingItem({ id: 'success', checked: true, foodId: 'food-a' });
    const itemB = mockMealieShoppingItem({ id: 'failure', checked: true, foodId: 'food-b' });
    const mappingA = mockProductMapping({ mealieFoodId: 'food-a', grocyProductId: 201 });
    const mappingB = mockProductMapping({ mealieFoodId: 'food-b', grocyProductId: 202 });

    mockedFetchAll.mockResolvedValue([itemA, itemB]);
    mockLimit
      .mockResolvedValueOnce([mappingA])
      .mockResolvedValueOnce([mappingB]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    // First item succeeds, second throws
    mockedAddProductStock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Stock add failed'));

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    // Item A should be in checked state
    expect(savedState.mealieCheckedItems['success']).toBe(true);
    // Item B should NOT be in checked state (removed for retry)
    expect(savedState.mealieCheckedItems).not.toHaveProperty('failure');
    // Only item A should have a syncRestockedProducts entry
    expect(savedState.syncRestockedProducts).toHaveProperty('201');
    expect(savedState.syncRestockedProducts).not.toHaveProperty('202');
  });

  it('handles empty shopping list without errors and saves state', async () => {
    mockedFetchAll.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    expect(mockedSaveSyncState).toHaveBeenCalledTimes(1);
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedItems).toEqual({});
  });

  it('calls saveSyncState with correct updated state (lastMealiePoll and mealieCheckedItems)', async () => {
    const before = new Date();
    const itemChecked = mockMealieShoppingItem({ id: 'c1', checked: true, foodId: 'food-1' });
    const itemUnchecked = mockMealieShoppingItem({ id: 'u1', checked: false, foodId: 'food-2' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([itemChecked, itemUnchecked]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedSaveSyncState).toHaveBeenCalledTimes(1);
    const savedState = mockedSaveSyncState.mock.calls[0][0];

    // mealieCheckedItems should reflect both items
    expect(savedState.mealieCheckedItems).toEqual({ c1: true, u1: false });

    // lastMealiePoll should be a Date >= before
    expect(savedState.lastMealiePoll).toBeInstanceOf(Date);
    expect(savedState.lastMealiePoll!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
