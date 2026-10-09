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
// Check lifecycle ledger: bookings pass straight through to the mocked Grocy
// wrapper here; the ledger itself is covered by shop/__tests__.
// ---------------------------------------------------------------------------
vi.mock('../../shop/check-lifecycles', async () => {
  const grocy = await import('../../grocy/types');
  return {
    openCheckLifecycle: vi.fn(() => ({ id: 'lifecycle-1' })),
    findOpenLifecycle: vi.fn(() => null),
    getLifecycleBookings: vi.fn(() => []),
    retireLegacyCheckLifecycle: vi.fn(() => []),
    guardReceiptFulfillment: vi.fn(),
    setLifecycleStatus: vi.fn(),
    handleUncheckedItem: vi.fn(),
    reconcileCheckLifecycles: vi.fn(async () => ({ verifiedApplied: 0, stillUnknown: 0, retryRequested: [], closed: 0 })),
    bookCheckStock: vi.fn(async (_lifecycle: unknown, productId: number, amount: number) => {
      await grocy.addProductStock(productId, amount);
      return 'applied';
    }),
  };
});

// ---------------------------------------------------------------------------
// Unit context: every test product is stocked and bought in unit 1 unless a
// test installs its own context.
// ---------------------------------------------------------------------------
vi.mock('../../shop/context', () => ({
  loadUnitContext: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
vi.mock('../../settings', () => ({
  resolveShoppingListId: vi.fn(),
  resolveStockOnlyMinStock: vi.fn(),
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
import { resolveShoppingListId, resolveStockOnlyMinStock } from '../../settings';
import { getSyncState, saveSyncState } from '../state';
import { fetchAllMealieShoppingItems } from '../helpers';
import {
  getGrocyEntities,
  deleteGrocyEntity,
  getProductDetails,
  addProductStock,
} from '../../grocy/types';
import { loadUnitContext } from '../../shop/context';
import { bookCheckStock, findOpenLifecycle, getLifecycleBookings, openCheckLifecycle, retireLegacyCheckLifecycle, setLifecycleStatus } from '../../shop/check-lifecycles';
import { emptyUnitContext, type UnitContext } from '../../shop/units';

const DEFAULT_PRODUCT_IDS = [100, 101, 201, 202, 777];

function unitContext(configure: (ctx: UnitContext) => void = () => {}): UnitContext {
  const ctx = emptyUnitContext();
  for (const id of DEFAULT_PRODUCT_IDS) {
    ctx.grocyProducts.set(id, { id, name: `Product ${id}`, quIdStock: 1, quIdPurchase: 1, parentProductId: null, noOwnStock: false });
  }
  ctx.grocyUnitNames.set(1, 'pak');
  configure(ctx);
  return ctx;
}

// ---------------------------------------------------------------------------
// Typed mock accessors
// ---------------------------------------------------------------------------
const mockedResolveShoppingListId = vi.mocked(resolveShoppingListId);
const mockedResolveStockOnlyMinStock = vi.mocked(resolveStockOnlyMinStock);
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
  mockedResolveStockOnlyMinStock.mockResolvedValue(false);
  mockedGetSyncState.mockResolvedValue(
    mockSyncState({ lastMealiePoll: new Date('2026-03-27T12:00:00.000Z') }),
  );
  mockedSaveSyncState.mockResolvedValue(undefined);
  mockedFetchAll.mockResolvedValue([]);
  mockedGetGrocyEntities.mockResolvedValue([]);
  mockedDeleteGrocyEntity.mockResolvedValue(undefined);
  mockedAddProductStock.mockResolvedValue([]);

  // DB: no mappings by default
  mockLimit.mockResolvedValue([]);

  vi.mocked(loadUnitContext).mockResolvedValue(unitContext());
  vi.mocked(findOpenLifecycle).mockReturnValue(null);
  vi.mocked(getLifecycleBookings).mockReturnValue([]);
  vi.mocked(retireLegacyCheckLifecycle).mockReturnValue([]);
  vi.mocked(bookCheckStock).mockImplementation(async (_lifecycle, productId, amount) => {
    await addProductStock(productId, amount);
    return 'applied';
  });
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

    const result = await pollMealieForCheckedItems();

    expect(result.events).toEqual([
      expect.objectContaining({ kind: 'mutation', productName: 'Milk', source: 'Mealie', target: 'Grocy', details: expect.objectContaining({ amount: 1, mealieItemId: 'item-1' }) }),
      expect.objectContaining({ kind: 'mutation', category: 'shopping', productName: 'Milk' }),
    ]);
    expect(result.events?.[0].reason).toContain('checked off');
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
    mockedResolveStockOnlyMinStock.mockResolvedValue(true);
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
    mockedResolveStockOnlyMinStock.mockResolvedValue(true);
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
    mockedResolveStockOnlyMinStock.mockResolvedValue(true);
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

    const result = await pollMealieForCheckedItems();
    expect(result.events).toEqual([
      expect.objectContaining({ kind: 'mutation', details: expect.objectContaining({ amount: 1 }) }),
      expect.objectContaining({ kind: 'issue', level: 'warning', message: expect.stringContaining('Delete failed') }),
    ]);

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

  it('treats quantity=0 as 1 intentionally', async () => {
    const item = mockMealieShoppingItem({ id: 'qty-zero', checked: true, foodId: 'food-1', quantity: 0 });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // Intentional compatibility fallback: a checked item with quantity=0
    // is treated as a purchase of one unit.
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

  it('does not restock pre-checked items on the first poll', async () => {
    const item = mockMealieShoppingItem({ id: 'pre-checked', checked: true, foodId: 'food-1' });

    mockedFetchAll.mockResolvedValue([item]);
    mockedGetSyncState.mockResolvedValue(mockSyncState({ mealieCheckedItems: {} }));

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedItems).toEqual({ 'pre-checked': true });
  });

  it('does not restock checked items after state loss when no previous poll timestamp exists', async () => {
    const item = mockMealieShoppingItem({ id: 'recover-checked', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });
    const recoveredState = mockSyncState({
      lastMealiePoll: null,
      mealieCheckedItems: {},
      syncRestockedProducts: { '999': new Date().toISOString() },
    });

    mockedFetchAll.mockResolvedValue([item]);
    mockedGetSyncState.mockResolvedValue(recoveredState);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedItems).toEqual({ 'recover-checked': true });
    expect(savedState.syncRestockedProducts).toEqual({ '999': expect.any(String) });
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
      .mockResolvedValueOnce([])
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

  // -------------------------------------------------------------------------
  // Cleanup timestamp tracking
  // -------------------------------------------------------------------------

  it('records mealieCheckedAt timestamp when item transitions from unchecked to checked', async () => {
    const before = new Date();
    const item = mockMealieShoppingItem({ id: 'item-ts', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedAt).toHaveProperty('item-ts');
    expect(new Date(savedState.mealieCheckedAt['item-ts']).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('records mealieItemsSyncedToGrocy when processCheckedItem succeeds', async () => {
    const before = new Date();
    const item = mockMealieShoppingItem({ id: 'item-synced', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieItemsSyncedToGrocy).toHaveProperty('item-synced');
    expect(new Date(savedState.mealieItemsSyncedToGrocy['item-synced']).getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('clears mealieCheckedAt and mealieItemsSyncedToGrocy when item becomes unchecked', async () => {
    mockedGetSyncState.mockResolvedValue(
      mockSyncState({
        lastMealiePoll: new Date(),
        mealieCheckedItems: { 'item-1': true },
        mealieCheckedAt: { 'item-1': '2026-03-20T10:00:00.000Z' },
        mealieItemsSyncedToGrocy: { 'item-1': '2026-03-20T10:01:00.000Z' },
      }),
    );

    const item = mockMealieShoppingItem({ id: 'item-1', checked: false, foodId: 'food-1' });
    mockedFetchAll.mockResolvedValue([item]);

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedAt).not.toHaveProperty('item-1');
    expect(savedState.mealieItemsSyncedToGrocy).not.toHaveProperty('item-1');
  });

  it('preserves existing mealieCheckedAt timestamp for items that remain checked', async () => {
    const originalTimestamp = '2026-03-20T10:00:00.000Z';
    mockedGetSyncState.mockResolvedValue(
      mockSyncState({
        lastMealiePoll: new Date(),
        mealieCheckedItems: { 'item-1': true },
        mealieCheckedAt: { 'item-1': originalTimestamp },
      }),
    );

    const item = mockMealieShoppingItem({ id: 'item-1', checked: true, foodId: 'food-1' });
    mockedFetchAll.mockResolvedValue([item]);

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    // Timestamp should be preserved, not overwritten
    expect(savedState.mealieCheckedAt['item-1']).toBe(originalTimestamp);
  });

  it('clears mealieCheckedAt on failed processCheckedItem so retry gets fresh timestamp', async () => {
    const item = mockMealieShoppingItem({ id: 'fail-item', checked: true, foodId: 'food-1' });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedAddProductStock.mockRejectedValue(new Error('Grocy down'));

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieCheckedAt).not.toHaveProperty('fail-item');
    expect(savedState.mealieItemsSyncedToGrocy).not.toHaveProperty('fail-item');
  });

  // -------------------------------------------------------------------------
  // Sub-product return path
  // -------------------------------------------------------------------------

  it('restocks each sub-product individually when GMS_ITEMS_KEY extras are present', async () => {
    const subItems = [
      { name: 'Volle Melk', grocyProductId: 201, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-item',
      checked: true,
      foodId: 'food-1',
      note: null,
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100, grocyProductName: 'Melk' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledTimes(2);
    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 2);
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1);
  });

  it('uses note amounts over extras amounts when note has matching segments', async () => {
    const subItems = [
      { name: 'Volle Melk', grocyProductId: 201, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-note',
      checked: true,
      foodId: 'food-1',
      note: '3× Volle Melk | 2× Halfvolle Melk',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100, grocyProductName: 'Melk' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 3);
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 2);
  });

  it('falls back to extras amount for sub-products not present in note', async () => {
    const subItems = [
      { name: 'Volle Melk', grocyProductId: 201, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-partial-note',
      checked: true,
      foodId: 'food-1',
      note: '3× Volle Melk',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100, grocyProductName: 'Melk' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 3); // from note
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1); // from extras
  });

  it('disables note overrides when sub-products have duplicate names', async () => {
    const subItems = [
      { name: 'Melk', grocyProductId: 201, amount: 2 },
      { name: 'Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-dup',
      checked: true,
      foodId: 'food-1',
      note: '5× Melk',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100, grocyProductName: 'Melk' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // Note overrides disabled — use extras amounts
    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 2);
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1);
  });

  it('skips already-restocked sub-products on retry using mealieSubRestockProgress', async () => {
    const subItems = [
      { name: 'Volle Melk', grocyProductId: 201, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-retry',
      checked: true,
      foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 });
    const state = mockSyncState({
      lastMealiePoll: new Date('2026-03-27T12:00:00.000Z'),
      // 201 already done in a previous attempt
      mealieSubRestockProgress: { 'sub-retry': [201] },
    });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetSyncState.mockResolvedValue(state);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // Only 202 should be restocked; 201 was already done
    expect(mockedAddProductStock).toHaveBeenCalledTimes(1);
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1);
  });

  it('treats checked item with invalid GMS_ITEMS_KEY as a normal item (falls through to standard path)', async () => {
    const item = mockMealieShoppingItem({
      id: 'sub-invalid',
      checked: true,
      foodId: 'food-1',
      quantity: 1,
      extras: { grocy_sync_subproduct_items: [{ bad: true }] } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101, grocyProductName: 'Milk' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    // Falls through to normal path — restocks the parent product with quantity 1
    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
  });

  it('removes parent product from Grocy shopping list after sub-product restock', async () => {
    const subItems = [{ name: 'Volle Melk', grocyProductId: 201, amount: 1 }];
    const item = mockMealieShoppingItem({
      id: 'sub-cleanup',
      checked: true,
      foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100, grocyProductName: 'Melk' });
    const grocySi = mockGrocyShoppingItem({ id: 99, product_id: 100 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([grocySi] as any);

    await pollMealieForCheckedItems();

    expect(mockedDeleteGrocyEntity).toHaveBeenCalledWith('shopping_list', 99);
  });

  it('marks item for retry and does not commit progress when a sub-product restock fails', async () => {
    const subItems = [
      { name: 'Volle Melk', grocyProductId: 201, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-fail',
      checked: true,
      foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedAddProductStock
      .mockResolvedValueOnce([]) // 201 succeeds
      .mockRejectedValueOnce(new Error('Grocy 500')); // 202 fails

    const result = await pollMealieForCheckedItems();
    expect(result.events?.filter(event => event.kind === 'mutation')).toEqual([
      expect.objectContaining({ productName: 'Volle Melk', details: expect.objectContaining({ amount: 2, grocyProductId: 201 }) }),
    ]);
    expect(result.events).toContainEqual(expect.objectContaining({ kind: 'issue', productName: 'Halfvolle Melk' }));

    // Item removed from newCheckedState for retry
    const finalSave = mockedSaveSyncState.mock.calls.at(-1)![0];
    expect(finalSave.mealieCheckedItems).not.toHaveProperty('sub-fail');
    // No syncRestockedProducts entry
    expect(finalSave.syncRestockedProducts).not.toHaveProperty('100');
  });

  it('clears mealieSubRestockProgress after successful sub-product restock commit', async () => {
    const subItems = [{ name: 'Volle Melk', grocyProductId: 201, amount: 1 }];
    const item = mockMealieShoppingItem({
      id: 'sub-clear',
      checked: true,
      foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockResolvedValue([]);

    await pollMealieForCheckedItems();

    const finalSave = mockedSaveSyncState.mock.calls.at(-1)![0];
    expect(finalSave.mealieSubRestockProgress).not.toHaveProperty('sub-clear');
  });

  it('clears mealieSubRestockProgress when item becomes unchecked', async () => {
    mockedGetSyncState.mockResolvedValue(
      mockSyncState({
        lastMealiePoll: new Date(),
        mealieCheckedItems: { 'item-1': true },
        mealieSubRestockProgress: { 'item-1': [201] },
      }),
    );
    const item = mockMealieShoppingItem({ id: 'item-1', checked: false, foodId: 'food-1' });
    mockedFetchAll.mockResolvedValue([item]);

    await pollMealieForCheckedItems();

    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.mealieSubRestockProgress).not.toHaveProperty('item-1');
  });

  // -------------------------------------------------------------------------
  // no_own_stock guard
  // -------------------------------------------------------------------------

  it('skips stock add for product with no_own_stock=1 on normal path', async () => {
    const item = mockMealieShoppingItem({ id: 'no-own', checked: true, foodId: 'food-1', quantity: 1 });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockImplementation(async (entity: string) => {
      if (entity === 'products') return [{ id: 101, name: 'Milk', no_own_stock: 1 }] as any;
      return [];
    });

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    const savedState = mockedSaveSyncState.mock.calls[0][0];
    expect(savedState.syncRestockedProducts).toEqual({});
  });

  it('does not skip stock add when no_own_stock is absent (NaN guard)', async () => {
    const item = mockMealieShoppingItem({ id: 'own-ok', checked: true, foodId: 'food-1', quantity: 1 });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 101 });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockImplementation(async (entity: string) => {
      if (entity === 'products') return [{ id: 101, name: 'Milk' }] as any;
      return [];
    });

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(101, 1);
  });

  it('skips sub-product restock when sub has no_own_stock=1', async () => {
    const subItems = [
      { name: 'Volle Melk', grocyProductId: 201, amount: 2 },
      { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 },
    ];
    const item = mockMealieShoppingItem({
      id: 'sub-no-own',
      checked: true,
      foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: subItems } as any,
    });
    const mapping = mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100, grocyProductName: 'Melk' });

    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mapping]);
    mockedGetGrocyEntities.mockImplementation(async (entity: string) => {
      if (entity === 'products') return [
        { id: 201, name: 'Volle Melk', no_own_stock: 1 },
        { id: 202, name: 'Halfvolle Melk' },
      ] as any;
      return [];
    });

    await pollMealieForCheckedItems();

    // 201 is skipped, 202 is restocked
    expect(mockedAddProductStock).toHaveBeenCalledTimes(1);
    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1);
  });
});

// ===========================================================================
describe('unit conversion on check-off', () => {
  const GRAM = 15;
  const BLIK = 13;

  function chickpeasContext() {
    return unitContext((ctx) => {
      ctx.grocyProducts.set(58, { id: 58, name: 'Kikkererwten', quIdStock: BLIK, quIdPurchase: BLIK, parentProductId: null, noOwnStock: false });
      ctx.grocyUnitNames.set(BLIK, 'blik');
      ctx.grocyUnitNames.set(GRAM, 'gram');
      ctx.grocyConversions.push({ fromQuId: BLIK, toQuId: GRAM, factor: 400, productId: 58 });
      ctx.unitMappings.set('mealie-gram', { grocyUnitId: GRAM, factor: 1 });
      ctx.mealieUnits.set('mealie-gram', { id: 'mealie-gram', name: 'gram', abbreviation: 'g', standardUnit: 'gram', standardQuantity: 1 });
      ctx.mealieUnits.set('mealie-eetlepel', { id: 'mealie-eetlepel', name: 'eetlepel', abbreviation: 'el', standardUnit: 'milliliter', standardQuantity: 15 });
    });
  }

  function checkedChickpeas(overrides: Record<string, unknown> = {}) {
    mockLimit.mockResolvedValue([mockProductMapping({ mealieFoodId: 'food-58', grocyProductId: 58, grocyProductName: 'Kikkererwten', mealieFoodName: 'Kikkererwten' })]);
    vi.mocked(loadUnitContext).mockResolvedValue(chickpeasContext());
    return mockMealieShoppingItem({ id: 'row-58', checked: true, foodId: 'food-58', quantity: 400, unitId: 'mealie-gram', ...overrides });
  }

  it('books a recipe amount in the stock unit and records the conversion', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas()]);

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(58, 1);
    expect(vi.mocked(bookCheckStock)).toHaveBeenCalledWith(
      { id: 'lifecycle-1' }, 58, 1, 'Kikkererwten', {},
      { mealieQuantity: 400, mealieUnitId: 'mealie-gram', mealieUnitName: 'gram', factor: 0.0025 },
    );
    expect(result.events?.[0]).toMatchObject({
      message: 'Added 1 (400 gram) to Grocy stock for "Kikkererwten".',
      details: expect.objectContaining({ amount: 1, mealieQuantity: 400, mealieUnitName: 'gram', conversionFactor: 0.0025 }),
    });
  });

  it('reads the nested unit when Mealie omits unitId', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas({ unitId: undefined, unit: { id: 'mealie-gram', name: 'gram' } })]);

    await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(58, 1);
  });

  it('does not book a row it cannot convert and does not retry it', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas({ quantity: 2, unitId: 'mealie-eetlepel' })]);

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    expect(mockedDeleteGrocyEntity).not.toHaveBeenCalled();
    expect(vi.mocked(setLifecycleStatus)).toHaveBeenCalledWith('lifecycle-1', 'skipped');
    expect(result.events).toEqual([expect.objectContaining({
      level: 'warning',
      message: 'Did not add stock for "Kikkererwten": 2 eetlepel cannot be converted to blik.',
      reason: expect.stringContaining('uncheck and re-check it in Mealie'),
    })]);
    const saved = mockedSaveSyncState.mock.calls[0][0];
    expect(saved.mealieCheckedItems['row-58']).toBe(true);
    expect(saved.mealieItemsSyncedToGrocy['row-58']).toBeUndefined();
    expect(saved.syncRestockedProducts['58']).toBeUndefined();
  });

  it('retries rows on the next poll when the unit data cannot be loaded, with one warning', async () => {
    const first = checkedChickpeas();
    const second = mockMealieShoppingItem({ id: 'row-other', checked: true, foodId: 'food-58', quantity: 1 });
    mockedFetchAll.mockResolvedValue([first, second]);
    vi.mocked(loadUnitContext).mockRejectedValue(new Error('Grocy unavailable'));

    const result = await pollMealieForCheckedItems();

    expect(vi.mocked(loadUnitContext)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(openCheckLifecycle)).not.toHaveBeenCalled();
    expect(mockedAddProductStock).not.toHaveBeenCalled();
    expect(result.summary.failedItems).toBe(0);
    expect(result.events).toEqual([expect.objectContaining({ level: 'warning', message: expect.stringContaining('2 checked item(s) will be retried') })]);
    const saved = mockedSaveSyncState.mock.calls[0][0];
    expect(saved.mealieCheckedItems).toEqual({});
    expect(saved.mealieCheckedAt['row-58']).toBeUndefined();
  });

  it('re-uses the planned booking of a retried check without converting again', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas({ quantity: 800 })]);
    mockedGetGrocyEntities.mockResolvedValue([
      mockGrocyShoppingItem({ id: 7, product_id: 777 }),
      mockGrocyShoppingItem({ id: 8, product_id: 58 }),
    ] as any);
    vi.mocked(findOpenLifecycle).mockReturnValue({ id: 'lifecycle-1' } as any);
    vi.mocked(getLifecycleBookings).mockReturnValue([{
      effectId: 'effect-1', productId: 777, amount: 1, status: 'not_applied', transactionId: null, label: 'Kikkererwten', version: 2,
      conversion: { mealieQuantity: 400, mealieUnitId: 'mealie-gram', mealieUnitName: 'gram', factor: 0.0025 },
    }]);

    await pollMealieForCheckedItems();

    // The mapping now points at 58 and the row says 800 g, but the planned booking wins.
    expect(vi.mocked(loadUnitContext)).not.toHaveBeenCalled();
    expect(vi.mocked(openCheckLifecycle)).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-58' }), 777);
    expect(mockedAddProductStock).toHaveBeenCalledWith(777, 1);
    // Cleanup and the restock guard follow the booked product, not the current mapping.
    expect(mockedDeleteGrocyEntity).toHaveBeenCalledWith('shopping_list', 7);
    expect(mockedDeleteGrocyEntity).not.toHaveBeenCalledWith('shopping_list', 8);
    const saved = mockedSaveSyncState.mock.calls[0][0];
    expect(saved.syncRestockedProducts['777']).toBeDefined();
    expect(saved.syncRestockedProducts['58']).toBeUndefined();
  });

  it('retries a planned booking after its mapping was removed', async () => {
    mockedFetchAll.mockResolvedValue([mockMealieShoppingItem({ id: 'row-58', checked: true, foodId: 'food-58', quantity: 400, unitId: 'mealie-gram' })]);
    mockLimit.mockResolvedValue([]);
    vi.mocked(findOpenLifecycle).mockReturnValue({ id: 'lifecycle-1' } as any);
    vi.mocked(getLifecycleBookings).mockReturnValue([{
      effectId: 'effect-1', productId: 58, amount: 1, status: 'not_applied', transactionId: null, label: 'Kikkererwten', version: 2, conversion: null,
    }]);

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(58, 1);
    expect(result.events?.[0]).toMatchObject({ message: 'Added 1 to Grocy stock for "Kikkererwten".' });
  });

  it('never books an invalid quantity', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas({ quantity: Number.NaN })]);

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).not.toHaveBeenCalled();
    expect(result.events).toEqual([expect.objectContaining({ level: 'warning', details: expect.objectContaining({ reason: 'invalid_amount' }) })]);
  });

  it('reports nothing as booked when the booking was cancelled', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas()]);
    mockedGetGrocyEntities.mockResolvedValue([mockGrocyShoppingItem({ id: 5, product_id: 58 })] as any);
    vi.mocked(bookCheckStock).mockResolvedValue('cancelled');

    const result = await pollMealieForCheckedItems();

    expect(mockedDeleteGrocyEntity).not.toHaveBeenCalled();
    expect(result.events).toEqual([expect.objectContaining({ level: 'warning', message: 'Did not add stock for "Kikkererwten": its booking was cancelled earlier.' })]);
    const saved = mockedSaveSyncState.mock.calls[0][0];
    expect(saved.mealieItemsSyncedToGrocy['row-58']).toBeUndefined();
    expect(saved.syncRestockedProducts['58']).toBeUndefined();
    expect(result.summary.restockedProducts).toBe(0);
  });

  it('replaces unbooked pre-conversion bookings and books the converted amount', async () => {
    mockedFetchAll.mockResolvedValue([checkedChickpeas()]);
    vi.mocked(retireLegacyCheckLifecycle).mockReturnValue([
      { effectId: 'old', productId: 58, amount: 400, status: 'not_applied', transactionId: null, label: 'Kikkererwten', version: null, conversion: null },
    ]);

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(58, 1);
    expect(result.events?.[0]).toMatchObject({ message: 'Replaced an unbooked earlier booking for "Kikkererwten" with a unit-converted one.' });
  });

  it('leaves a sub-product row unsynced when a child booking was cancelled', async () => {
    const item = mockMealieShoppingItem({
      id: 'sub-row', checked: true, foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: [{ name: 'Volle Melk', grocyProductId: 201, amount: 2 }, { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 }] } as any,
    });
    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 })]);
    mockedGetGrocyEntities.mockResolvedValue([mockGrocyShoppingItem({ id: 9, product_id: 100 })] as any);
    vi.mocked(bookCheckStock).mockImplementation(async (_lifecycle, productId, amount) => {
      if (productId === 202) return 'cancelled';
      await addProductStock(productId, amount);
      return 'applied';
    });

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 2);
    expect(mockedDeleteGrocyEntity).not.toHaveBeenCalled();
    expect(result.summary.restockedProducts).toBe(0);
    const saved = mockedSaveSyncState.mock.calls[0][0];
    expect(saved.mealieItemsSyncedToGrocy['sub-row']).toBeUndefined();
    expect(saved.syncRestockedProducts['100']).toBeUndefined();
    expect(saved.mealieCheckedItems['sub-row']).toBe(true);
  });

  it('remembers a cancelled child across polls and never re-checks the whole row', async () => {
    const subItems = [{ name: 'Volle Melk', grocyProductId: 201, amount: 2 }, { name: 'Halfvolle Melk', grocyProductId: 202, amount: 1 }];
    const item = mockMealieShoppingItem({ id: 'sub-row', checked: true, foodId: 'food-1', extras: { grocy_sync_subproduct_items: subItems } as any });
    mockLimit.mockResolvedValue([mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 })]);
    mockedGetGrocyEntities.mockResolvedValue([mockGrocyShoppingItem({ id: 9, product_id: 100 })] as any);
    mockedFetchAll.mockResolvedValue([item]);
    // Poll 2: child 201 was cancelled and is in progress; child 202 failed before and now succeeds.
    mockedGetSyncState.mockResolvedValue(mockSyncState({
      lastMealiePoll: new Date('2026-03-27T12:00:00.000Z'),
      mealieSubRestockProgress: { 'sub-row': [201] },
    }));
    vi.mocked(getLifecycleBookings).mockReturnValue([
      { effectId: 'e-201', productId: 201, amount: 2, status: 'cancelled', transactionId: null, label: 'Volle Melk', version: 2, conversion: null },
      { effectId: 'e-202', productId: 202, amount: 1, status: 'applied', transactionId: 'tx', label: 'Halfvolle Melk', version: 2, conversion: null },
    ]);

    const result = await pollMealieForCheckedItems();

    expect(mockedAddProductStock).toHaveBeenCalledWith(202, 1);
    expect(mockedAddProductStock).not.toHaveBeenCalledWith(201, 2);
    expect(mockedDeleteGrocyEntity).not.toHaveBeenCalled();
    // The applied child keeps the lifecycle completed so a receipt credits it.
    expect(vi.mocked(setLifecycleStatus)).toHaveBeenCalledWith('lifecycle-1', 'completed');
    expect(result.summary.restockedProducts).toBe(0);
    const saved = mockedSaveSyncState.mock.calls[0][0];
    expect(saved.mealieItemsSyncedToGrocy['sub-row']).toBeUndefined();
  });

  it('advises booking a cancelled child manually instead of re-checking the row', async () => {
    const item = mockMealieShoppingItem({
      id: 'sub-row', checked: true, foodId: 'food-1',
      extras: { grocy_sync_subproduct_items: [{ name: 'Volle Melk', grocyProductId: 201, amount: 2 }] } as any,
    });
    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 })]);
    vi.mocked(bookCheckStock).mockResolvedValue('cancelled');

    const result = await pollMealieForCheckedItems();

    const warning = result.events?.find(event => event.level === 'warning');
    expect(warning?.reason).toContain('do not re-check the Mealie row');
    expect(warning?.reason).not.toContain('Uncheck and re-check');
  });

  it('keeps sub-product rows on their stock amounts without loading unit data', async () => {
    const item = mockMealieShoppingItem({
      id: 'sub-row', checked: true, foodId: 'food-1', quantity: 400, unitId: 'mealie-gram',
      extras: { grocy_sync_subproduct_items: [{ name: 'Volle Melk', grocyProductId: 201, amount: 2 }] } as any,
    });
    mockedFetchAll.mockResolvedValue([item]);
    mockLimit.mockResolvedValue([mockProductMapping({ mealieFoodId: 'food-1', grocyProductId: 100 })]);

    await pollMealieForCheckedItems();

    expect(vi.mocked(loadUnitContext)).not.toHaveBeenCalled();
    expect(vi.mocked(retireLegacyCheckLifecycle)).not.toHaveBeenCalled();
    expect(mockedAddProductStock).toHaveBeenCalledWith(201, 2);
  });
});
