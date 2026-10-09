import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productMappings, unitMappings } from '../../db/schema';
import {
  mockMealieShoppingItem,
  mockProductMapping,
  mockUnitMapping,
  mockSyncState,
  mockMissingProduct,
} from './helpers/mocks';

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the module under test)
// ---------------------------------------------------------------------------

// DB mock: drizzle chain db.select().from(table).where(...).limit(n)
// We track which table is queried via mockFrom so mockLimit can return the
// appropriate rows.
const mockLimit = vi.fn<(...args: any[]) => any>();
const mockWhere = vi.fn<(...args: any[]) => any>(() => ({ limit: mockLimit }));
const mockFrom = vi.fn<(...args: any[]) => any>(() => ({ where: mockWhere }));
const mockSelect = vi.fn<(...args: any[]) => any>(() => ({ from: mockFrom }));

vi.mock('../../db', () => ({
  db: { select: (...args: any[]) => mockSelect(...args) },
}));

vi.mock('../../grocy/types', () => ({
  getVolatileStock: vi.fn(),
  getGrocyEntities: vi.fn(),
  getCurrentStock: vi.fn(),
}));

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
  resolveSyncSubProducts: vi.fn().mockResolvedValue(false),
  resolveSyncParentOwnStock: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../shop/low-stock-accounting', () => ({
  loadLowStockAdjustments: vi.fn(() => ({ accounted: [], frozenProductIds: new Set() })),
}));

vi.mock('../state', () => ({
  getSyncState: vi.fn(),
  saveSyncState: vi.fn(),
}));

vi.mock('../helpers', () => ({
  fetchAllMealieShoppingItems: vi.fn(),
}));

vi.mock('../mealie-in-possession', () => ({
  syncMealieInPossessionFromGrocy: vi.fn(async () => ({
    status: 'skipped',
    reason: 'disabled',
    summary: {
      processedProducts: 0,
      updatedProducts: 0,
      enabledProducts: 0,
      disabledProducts: 0,
      unchangedProducts: 0,
      failedProducts: 0,
    },
  })),
}));

vi.mock('../../logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test and mocked dependencies
// ---------------------------------------------------------------------------

import { pollGrocyForMissingStock } from '../grocy-to-mealie';
import { getGrocyEntities, getVolatileStock, getCurrentStock } from '../../grocy/types';
import { HouseholdsShoppingListItemsService } from '../../mealie';
import { resolveEnsureLowStockOnMealieList, resolveShoppingListId, resolveSyncSubProducts, resolveSyncParentOwnStock } from '../../settings';
import { getSyncState, saveSyncState } from '../state';
import { fetchAllMealieShoppingItems } from '../helpers';
import { syncMealieInPossessionFromGrocy } from '../mealie-in-possession';
import { log } from '../../logger';

// Type-safe mock accessors
const mockedGetGrocyEntities = vi.mocked(getGrocyEntities);
const mockedGetVolatileStock = vi.mocked(getVolatileStock);
const mockedGetCurrentStock = vi.mocked(getCurrentStock);
const mockedResolveShoppingListId = vi.mocked(resolveShoppingListId);
const mockedResolveEnsureLowStockOnMealieList = vi.mocked(resolveEnsureLowStockOnMealieList);
const mockedResolveSyncSubProducts = vi.mocked(resolveSyncSubProducts);
const mockedResolveSyncParentOwnStock = vi.mocked(resolveSyncParentOwnStock);
const mockedGetSyncState = vi.mocked(getSyncState);
const mockedSaveSyncState = vi.mocked(saveSyncState);
const mockedFetchItems = vi.mocked(fetchAllMealieShoppingItems);
const mockedSyncMealieInPossessionFromGrocy = vi.mocked(syncMealieInPossessionFromGrocy);
const mockedCreate = vi.mocked(HouseholdsShoppingListItemsService.createOneApiHouseholdsShoppingItemsPost);
const mockedUpdate = vi.mocked(HouseholdsShoppingListItemsService.updateOneApiHouseholdsShoppingItemsItemIdPut);
const mockedDelete = vi.mocked(HouseholdsShoppingListItemsService.deleteOneApiHouseholdsShoppingItemsItemIdDelete);

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const SHOPPING_LIST_ID = 'list-1';
const DEFAULT_MAPPING = mockProductMapping();
const DEFAULT_UNIT_MAPPING = mockUnitMapping();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configure the DB mock to return the right rows based on which table is
 * queried. The `from()` call receives the table schema object so we can
 * discriminate on it.
 */
function setupDbMock(
  productMappingRows: ReturnType<typeof mockProductMapping>[] = [DEFAULT_MAPPING],
  unitMappingRows: ReturnType<typeof mockUnitMapping>[] = [],
) {
  mockFrom.mockImplementation((table: unknown) => {
    mockWhere.mockImplementation(() => {
      mockLimit.mockImplementation(() => {
        if (table === productMappings) return Promise.resolve(productMappingRows);
        if (table === unitMappings) return Promise.resolve(unitMappingRows);
        return Promise.resolve([]);
      });
      return { limit: mockLimit };
    });
    return { where: mockWhere };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollGrocyForMissingStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Sensible defaults: a valid shopping list, empty state, no items on list
    mockedResolveShoppingListId.mockResolvedValue(SHOPPING_LIST_ID);
    mockedResolveEnsureLowStockOnMealieList.mockResolvedValue(false);
    mockedGetSyncState.mockResolvedValue(mockSyncState());
    mockedSaveSyncState.mockResolvedValue(undefined);
    mockedFetchItems.mockResolvedValue([]);
    mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
    mockedGetCurrentStock.mockResolvedValue([]);
    mockedGetGrocyEntities.mockResolvedValue([
      { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 },
    ] as any);

    // Default DB: mapping exists, no unit mapping
    setupDbMock([DEFAULT_MAPPING], []);
  });

  // -----------------------------------------------------------------------
  // Happy paths
  // -----------------------------------------------------------------------

  describe('happy paths', () => {
    it('adds newly missing product to Mealie shopping list', async () => {
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith({
        shoppingListId: SHOPPING_LIST_ID,
        foodId: 'food-1',
        unitId: undefined,
        quantity: 2,
        checked: false,
      });
    });

    it('increases quantity when amount_missing increases (delta +3)', async () => {
      // Previous state: product 101 was missing 2
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 5 })],
      });
      // Existing unchecked item on Mealie list with quantity 2
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // delta = 5 - 2 = 3, new qty = 2 + 3 = 5
      expect(mockedUpdate).toHaveBeenCalledOnce();
      expect(mockedUpdate).toHaveBeenCalledWith('mealie-item-1', {
        shoppingListId: SHOPPING_LIST_ID,
        quantity: 5,
        foodId: 'food-1',
        unitId: undefined,
      });
    });

    it('decreases quantity when amount_missing decreases (delta -3)', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 5 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 5, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // delta = 2 - 5 = -3, new qty = 5 + (-3) = 2
      expect(mockedUpdate).toHaveBeenCalledOnce();
      expect(mockedUpdate).toHaveBeenCalledWith('mealie-item-1', {
        shoppingListId: SHOPPING_LIST_ID,
        quantity: 2,
        foodId: 'food-1',
        unitId: undefined,
      });
    });

    it('removes item from Mealie when product is no longer missing (manual restock)', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 3 } }),
      );
      // No missing products now
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 3, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // delta = -3, current qty 3, new qty = 0 -> delete
      expect(mockedDelete).toHaveBeenCalledOnce();
      expect(mockedDelete).toHaveBeenCalledWith('mealie-item-1');
    });
  });

  describe('ensureLowStockOnMealieList', () => {
    it('recreates an unchanged missing product when ensure mode is enabled and the item is absent', async () => {
      mockedResolveEnsureLowStockOnMealieList.mockResolvedValue(true);
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith({
        shoppingListId: SHOPPING_LIST_ID,
        foodId: 'food-1',
        unitId: undefined,
        quantity: 2,
        checked: false,
      });
    });

    it('creates the full current missing amount when a changed product is absent and ensure mode is enabled', async () => {
      mockedResolveEnsureLowStockOnMealieList.mockResolvedValue(true);
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 5 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith({
        shoppingListId: SHOPPING_LIST_ID,
        foodId: 'food-1',
        unitId: undefined,
        quantity: 5,
        checked: false,
      });
    });

    it('does not touch an unchanged missing product when ensure mode is enabled and the item already exists', async () => {
      mockedResolveEnsureLowStockOnMealieList.mockResolvedValue(true);
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Feedback loop prevention
  // -----------------------------------------------------------------------

  describe('feedback loop prevention', () => {
    it('skips removal for products in syncRestockedProducts', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          grocyBelowMinStock: { 101: 2 },
          syncRestockedProducts: { '101': new Date().toISOString() },
        }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // Should NOT call delete, update, or create
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('logs the Grocy product name when skipping sync-restocked removals', async () => {
      setupDbMock([
        mockProductMapping({
          mealieFoodName: 'Optimel',
          grocyProductName: 'Optimel Drinkyogurt',
        }),
      ], []);

      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          grocyBelowMinStock: { 101: 2 },
          syncRestockedProducts: { '101': new Date().toISOString() },
        }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });

      await pollGrocyForMissingStock();

      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        '[Grocy→Mealie] Skipping removal for "Optimel Drinkyogurt" — restocked by sync, not manually',
      );
    });

    it('clears syncRestockedProducts to {} after poll completes', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          syncRestockedProducts: { '101': new Date().toISOString(), '202': new Date().toISOString() },
        }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });

      await pollGrocyForMissingStock();

      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.syncRestockedProducts).toEqual({});
    });

    it('saves skipped amount to grocySkippedRestockAmounts when removal is skipped', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          grocyBelowMinStock: { 101: 4 },
          syncRestockedProducts: { '101': new Date().toISOString() },
        }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });

      await pollGrocyForMissingStock();

      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocySkippedRestockAmounts).toEqual({ 101: 4 });
    });

    it('uses grocySkippedRestockAmounts to correctly adjust stale item qty when product goes missing again', async () => {
      // Simulate the scenario:
      // - Previous poll: Melk had qty=4 (combined sub-products), was restocked, removal skipped
      //   → grocySkippedRestockAmounts = { 101: 4 }, grocyBelowMinStock = {} (not missing)
      // - Current poll: Melk is missing again at amount=1 (user consumed it)
      // Expected: existing stale item at qty=4 is adjusted to qty=1 (delta=-3), NOT 4+1=5
      const staleItem = mockMealieShoppingItem({
        id: 'mealie-item-1',
        foodId: 'food-1',
        quantity: 4,
        checked: false,
      });
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          grocyBelowMinStock: {},
          grocySkippedRestockAmounts: { 101: 4 },
        }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 1 })],
      });
      mockedFetchItems.mockResolvedValue([staleItem]);

      await pollGrocyForMissingStock();

      // Delta = 1 - 4 = -3, so existing qty 4 → 1
      expect(mockedUpdate).toHaveBeenCalledOnce();
      expect(mockedUpdate).toHaveBeenCalledWith(
        'mealie-item-1',
        expect.objectContaining({ quantity: 1 }),
      );
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('handles mix: sync-restocked product skipped + manually restocked product removed', async () => {
      // Product 101 was restocked by sync, product 202 was restocked manually
      const mapping202 = mockProductMapping({
        id: 'mapping-2',
        mealieFoodId: 'food-2',
        mealieFoodName: 'Butter',
        grocyProductId: 202,
        grocyProductName: 'Butter',
      });

      setupDbMock([], []);
      // Override to return different mappings per grocyProductId
      mockFrom.mockImplementation((table: unknown) => {
        mockWhere.mockImplementation((condition: unknown) => {
          mockLimit.mockImplementation(() => {
            if (table === productMappings) {
              // Return the appropriate mapping based on which query is being made.
              // The eq() calls are mocked, so we inspect the mock call args.
              // We need a different approach: check the last where() call's argument.
              // Since drizzle's eq returns an object, we look at what was passed.
              return Promise.resolve([DEFAULT_MAPPING]);
            }
            return Promise.resolve([]);
          });
          return { limit: mockLimit };
        });
        return { where: mockWhere };
      });

      // More precise: track which product the DB is queried for
      let dbQueryCount = 0;
      mockFrom.mockImplementation((table: unknown) => {
        return {
          where: () => ({
            limit: () => {
              if (table === productMappings) {
                dbQueryCount++;
                // Only the manually restocked product (202) triggers a DB query
                // because the sync-restocked one (101) is skipped entirely
                return Promise.resolve([mapping202]);
              }
              return Promise.resolve([]);
            },
          }),
        };
      });

      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          grocyBelowMinStock: { 101: 2, 202: 3 },
          syncRestockedProducts: { '101': new Date().toISOString() },
        }),
      );
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 },
        { id: 202, name: 'Butter', qu_id_stock: 10, qu_id_purchase: 10 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
        mockMealieShoppingItem({ id: 'mealie-item-2', foodId: 'food-2', quantity: 3, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // Product 101 skipped (sync-restocked), product 202 removed (manually restocked)
      expect(mockedDelete).toHaveBeenCalledOnce();
      expect(mockedDelete).toHaveBeenCalledWith('mealie-item-2');
    });
  });

  // -----------------------------------------------------------------------
  // adjustMealieShoppingItem logic
  // -----------------------------------------------------------------------

  describe('adjustMealieShoppingItem logic', () => {
    it('skips and makes no API calls when no product mapping is found', async () => {
      setupDbMock([], []);

      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 999, name: 'Bananen', amount_missing: 1 })],
      });

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
        '[Grocy→Mealie] No mapping found for Grocy product ID 999 ("Bananen"), skipping',
      );
    });

    it('returns ensure summary with mapped and unmapped product counts', async () => {
      mockFrom.mockImplementation((table: unknown) => {
        return {
          where: () => ({
            limit: () => {
              if (table === productMappings) {
                const callIndex = mockFrom.mock.calls.filter(call => call[0] === productMappings).length;
                if (callIndex === 1) {
                  return Promise.resolve([DEFAULT_MAPPING]);
                }

                return Promise.resolve([]);
              }

              return Promise.resolve([]);
            },
          }),
        };
      });

      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [
          mockMissingProduct({ id: 101, amount_missing: 2 }),
          mockMissingProduct({ id: 999, name: 'Bananen', amount_missing: 1 }),
        ],
      });

      const result = await pollGrocyForMissingStock({ ensureAllPresent: true });

      expect(result).toMatchObject({
        // Unmapped products are a backlog, not a degradation — the run stays 'ok'
        // and only the summary reports the count.
        status: 'ok',
        inPossessionStatus: 'skipped',
        inPossessionSummary: {
          processedProducts: 0,
          updatedProducts: 0,
          enabledProducts: 0,
          disabledProducts: 0,
          unchangedProducts: 0,
          failedProducts: 0,
        },
        summary: {
          processedProducts: 2,
          ensuredProducts: 1,
          unmappedProducts: 1,
        },
      });
      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
        '[Grocy→Mealie] No mapping found for Grocy product ID 999 ("Bananen"), skipping',
      );
    });

    it('suppresses unmapped warnings during automatic presence checks and logs the unmapped count in the summary line', async () => {
      setupDbMock([], []);
      mockedResolveEnsureLowStockOnMealieList.mockResolvedValue(true);
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 999: 1 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 999, name: 'Bananen', amount_missing: 1 })],
      });

      const result = await pollGrocyForMissingStock();

      expect(result).toMatchObject({
        // Unmapped products are a backlog, not a degradation — the run stays 'ok'
        // and only the summary reports the count.
        status: 'ok',
        inPossessionStatus: 'skipped',
        inPossessionSummary: {
          processedProducts: 0,
          updatedProducts: 0,
          enabledProducts: 0,
          disabledProducts: 0,
          unchangedProducts: 0,
          failedProducts: 0,
        },
        summary: {
          processedProducts: 1,
          ensuredProducts: 0,
          unmappedProducts: 1,
        },
      });
      expect(vi.mocked(log.warn)).not.toHaveBeenCalledWith(
        '[Grocy→Mealie] No mapping found for Grocy product ID 999 ("Bananen"), skipping',
      );
      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        '[Grocy→Mealie] Presence check completed for 1 still-missing product(s) (1 unmapped)',
      );
    });

    it('logs unmapped presence-check products when explicitly enabled for UI-triggered ensure runs', async () => {
      setupDbMock([], []);
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 999: 1 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 999, name: 'Bananen', amount_missing: 1 })],
      });

      await pollGrocyForMissingStock({
        ensureAllPresent: true,
        logUnmappedPresenceCheckProducts: true,
      });

      expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
        '[Grocy→Mealie] No mapping found for Grocy product ID 999 ("Bananen"), skipping',
      );
      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        '[Grocy→Mealie] Presence check completed for 1 still-missing product(s) (1 unmapped)',
      );
    });

    it('updates quantity for existing unchecked item with positive delta', async () => {
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 3 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // Newly missing with delta=3, existing item qty=2, new qty=2+3=5
      expect(mockedUpdate).toHaveBeenCalledOnce();
      expect(mockedUpdate).toHaveBeenCalledWith('mealie-item-1', {
        shoppingListId: SHOPPING_LIST_ID,
        quantity: 5,
        foodId: 'food-1',
        unitId: undefined,
      });
    });

    it('updates quantity when negative delta still leaves qty > 0', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 5 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 3 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 5, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // delta = 3 - 5 = -2, current=5, new=3
      expect(mockedUpdate).toHaveBeenCalledOnce();
      expect(mockedUpdate).toHaveBeenCalledWith('mealie-item-1', {
        shoppingListId: SHOPPING_LIST_ID,
        quantity: 3,
        foodId: 'food-1',
        unitId: undefined,
      });
      expect(mockedDelete).not.toHaveBeenCalled();
    });

    it('deletes item when negative delta drops quantity to 0 or below', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 5 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 3, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // no longer missing -> delta = -5, current=3, new = 3 + (-5) = -2 <= 0 -> delete
      expect(mockedDelete).toHaveBeenCalledOnce();
      expect(mockedDelete).toHaveBeenCalledWith('mealie-item-1');
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it('creates new item when no existing unchecked item and positive delta', async () => {
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 4 })],
      });
      mockedFetchItems.mockResolvedValue([]); // no items on list

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith({
        shoppingListId: SHOPPING_LIST_ID,
        foodId: 'food-1',
        unitId: undefined,
        quantity: 4,
        checked: false,
      });
    });

    it('does nothing when no existing item and negative delta (no-op)', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 3 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      // No matching item on Mealie list
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
    });

    it('labels the row with the Mealie unit of the Grocy stock unit, not the purchase unit', async () => {
      const stockUnitMapping = mockUnitMapping({ grocyUnitId: 10 });
      setupDbMock([DEFAULT_MAPPING], [stockUnitMapping]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 20 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith({
        shoppingListId: SHOPPING_LIST_ID,
        foodId: 'food-1',
        unitId: 'mealie-unit-1',
        quantity: 2,
        checked: false,
      });
    });

    it('writes no unit when the stock unit counts pieces, even if the product mapping has a unit', async () => {
      const mappingWithUnit = mockProductMapping({ unitMappingId: 'unit-mapping-1' });
      setupDbMock([mappingWithUnit], []);
      mockedGetGrocyEntities.mockImplementation((async (entity: string) => entity === 'quantity_units'
        ? [{ id: 2, name: 'Stuk' }, { id: 11, name: 'Doos' }]
        : [{ id: 101, name: 'Eggs', qu_id_stock: 2, qu_id_purchase: 11 }]) as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 10 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ unitId: undefined, quantity: 10 }));
    });

    it('removes an unlabelled count row once the product is restocked', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetGrocyEntities.mockImplementation((async (entity: string) => entity === 'quantity_units'
        ? [{ id: 2, name: 'Stuk' }, { id: 11, name: 'Doos' }]
        : [{ id: 101, name: 'Eggs', qu_id_stock: 2, qu_id_purchase: 11 }]) as any);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 10 } }));
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'eggs-row', foodId: 'food-1', quantity: 10, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      expect(mockedDelete).toHaveBeenCalledWith('eggs-row');
    });

    it('does not write a shortage whose stock unit has no Mealie unit and does not count pieces', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetGrocyEntities.mockImplementation((async (entity: string) => entity === 'quantity_units'
        ? [{ id: 14, name: 'kilogram' }, { id: 9, name: 'zak' }]
        : [{ id: 101, name: 'Flour', qu_id_stock: 14, qu_id_purchase: 9 }]) as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'unlabelled', foodId: 'food-1', quantity: 1, checked: false }),
      ]);

      const result = await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(result.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ level: 'warning', message: 'Did not add "Milk" to the Mealie shopping list: its Grocy stock unit is unknown or has no Mealie unit.' }),
      ]));
    });

    it('leaves the list untouched when Grocy products cannot be loaded', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetGrocyEntities.mockRejectedValue(new Error('Grocy down'));
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 1 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 3 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'unlabelled', foodId: 'food-1', quantity: 1, checked: false }),
      ]);

      const result = await pollGrocyForMissingStock();

      expect(result.status).toBe('error');
      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedSaveSyncState).not.toHaveBeenCalled();
    });

    it('keeps an unwritable shortage eligible so it is written once the unit is mapped', async () => {
      const flourEntities = (async (entity: string) => entity === 'quantity_units'
        ? [{ id: 14, name: 'kilogram' }, { id: 9, name: 'zak' }]
        : [{ id: 101, name: 'Flour', qu_id_stock: 14, qu_id_purchase: 9 }]) as any;
      mockedGetGrocyEntities.mockImplementation(flourEntities);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);
      setupDbMock([DEFAULT_MAPPING], []);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      const firstState = mockedSaveSyncState.mock.calls.at(-1)![0];
      expect(firstState.grocyBelowMinStock[101]).toBeUndefined();

      // The user maps kilogram; the next poll still sees the shortage as new and writes it.
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: firstState.grocyBelowMinStock }));
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 14, mealieUnitId: 'mealie-kg' })]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ unitId: 'mealie-kg', quantity: 2 }));
    });

    it('changes nothing when Grocy unit names cannot be loaded', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetGrocyEntities.mockImplementation((async (entity: string) => {
        if (entity === 'quantity_units') throw new Error('Grocy hiccup');
        return [{ id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 }];
      }) as any);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 1 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 3 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'own-row', foodId: 'food-1', quantity: 1, checked: false }),
      ]);

      const result = await pollGrocyForMissingStock();

      expect(result.status).toBe('error');
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedSaveSyncState).not.toHaveBeenCalled();
    });

    it('treats an invalid unit mapping factor like a missing mapping', async () => {
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 10, conversionFactor: 0 })]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      // Purchase and stock agree, so an unlabelled row still means the stock unit.
      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ unitId: undefined, quantity: 2 }));
    });

    it('expresses the shortage in the Mealie unit using the unit mapping factor', async () => {
      // 1 Mealie unit holds 2 Grocy stock units.
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 10, conversionFactor: 2 })]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 4 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ unitId: 'mealie-unit-1', quantity: 2 }));
    });

    it('keeps small changes when the unit mapping factor is large', async () => {
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 10, conversionFactor: 1000 })]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Saffron', qu_id_stock: 10, qu_id_purchase: 10 },
      ] as any);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 1 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 1.0001 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'own-row', foodId: 'food-1', unitId: 'mealie-unit-1', quantity: 0.001, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      const update = mockedUpdate.mock.calls[0]?.[1] as { quantity: number } | undefined;
      expect(update?.quantity).toBeCloseTo(0.0010001, 10);
    });

    it('recognises its own row when Mealie only sends the nested unit', async () => {
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 10 })]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 },
      ] as any);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 2 } }));
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'own-row', foodId: 'food-1', unit: { id: 'mealie-unit-1', name: 'Liter' } as any, quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      expect(mockedDelete).toHaveBeenCalledWith('own-row');
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('never merges a shortage into a recipe row in another unit', async () => {
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 13, mealieUnitId: 'mealie-blik' })]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Chickpeas', qu_id_stock: 13, qu_id_purchase: 13 },
      ] as any);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 1 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'recipe-row', foodId: 'food-1', unitId: 'mealie-gram', quantity: 400, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // The 400 g row stays as it is; the sync writes its own row with the full shortage.
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ unitId: 'mealie-blik', quantity: 2 }));
    });

    it('never adjusts a same-unit row that came from a recipe', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 3 } }));
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({
          id: 'recipe-row', foodId: 'food-1', quantity: 3, checked: false,
          recipeReferences: [{ id: 'ref-1', shoppingListItemId: 'recipe-row', recipeId: 'recipe-1' }] as any,
        }),
      ]);

      await pollGrocyForMissingStock();

      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it('does not create a row when a shortage decreases and the sync has no row', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 5 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('creates the full shortage when an increase finds no row of the sync (legacy purchase-unit row)', async () => {
      setupDbMock([DEFAULT_MAPPING], [mockUnitMapping({ grocyUnitId: 3, mealieUnitId: 'mealie-pak' })]);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Coconut milk', qu_id_stock: 3, qu_id_purchase: 8 },
      ] as any);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 10 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 11 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'legacy-row', foodId: 'food-1', unitId: 'mealie-verpakking', quantity: 10, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ unitId: 'mealie-pak', quantity: 11 }));
    });

    it('creates nothing for an unchanged shortage without a row when presence is not enforced', async () => {
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 2 } }));
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('passes unitId as undefined when mapping has no unitMappingId', async () => {
      // Default mapping has unitMappingId: null
      setupDbMock([DEFAULT_MAPPING], []);

      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: undefined }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Skip / No-Op
  // -----------------------------------------------------------------------

  describe('skip / no-op', () => {
    it('skips entire poll when no shopping list is configured', async () => {
      mockedResolveShoppingListId.mockResolvedValue(null);

      const result = await pollGrocyForMissingStock();

      expect(mockedGetVolatileStock).not.toHaveBeenCalled();
      expect(mockedGetSyncState).toHaveBeenCalledOnce();
      expect(mockedSyncMealieInPossessionFromGrocy).toHaveBeenCalledOnce();
      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        status: 'skipped',
        reason: 'no-shopping-list',
        inPossessionStatus: 'skipped',
        inPossessionSummary: {
          processedProducts: 0,
          updatedProducts: 0,
          enabledProducts: 0,
          disabledProducts: 0,
          unchangedProducts: 0,
          failedProducts: 0,
        },
        summary: {
          processedProducts: 0,
          ensuredProducts: 0,
          unmappedProducts: 0,
        },
      });
      expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
        expect.stringContaining('No shopping list configured'),
      );
    });

    it('still updates sync state when no shopping list is configured', async () => {
      mockedResolveShoppingListId.mockResolvedValue(null);

      await pollGrocyForMissingStock();

      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocyBelowMinStock).toEqual({});
      expect(savedState.lastGrocyPoll).toBeInstanceOf(Date);
    });

    it('saves state with empty grocyBelowMinStock when no products are missing', async () => {
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocyBelowMinStock).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('aborts gracefully when getVolatileStock throws', async () => {
      const error = new Error('Grocy API down');
      mockedGetVolatileStock.mockRejectedValue(error);

      await pollGrocyForMissingStock();

      expect(vi.mocked(log.error)).toHaveBeenCalledWith(
        expect.stringContaining('Error polling Grocy'),
        error,
      );
      expect(mockedSaveSyncState).not.toHaveBeenCalled();
    });

    it('treats undefined missing_products as empty array', async () => {
      mockedGetVolatileStock.mockResolvedValue({ missing_products: undefined });

      await pollGrocyForMissingStock();

      // No crash, state saved normally with empty grocyBelowMinStock
      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocyBelowMinStock).toEqual({});
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('returns partial when the in-possession sync fails after low-stock sync succeeds', async () => {
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedSyncMealieInPossessionFromGrocy.mockResolvedValue({
        status: 'error',
        summary: {
          processedProducts: 1,
          updatedProducts: 0,
          enabledProducts: 0,
          disabledProducts: 0,
          unchangedProducts: 0,
          failedProducts: 1,
        },
      });

      const result = await pollGrocyForMissingStock();

      expect(result).toMatchObject({
        status: 'partial',
        inPossessionStatus: 'error',
        inPossessionSummary: {
          processedProducts: 1,
          updatedProducts: 0,
          enabledProducts: 0,
          disabledProducts: 0,
          unchangedProducts: 0,
          failedProducts: 1,
        },
        summary: {
          processedProducts: 1,
          ensuredProducts: 1,
          unmappedProducts: 0,
        },
      });
      expect(vi.mocked(log.error)).toHaveBeenCalledWith(
        '[Grocy→Mealie] "In possession" sync failed after low-stock processing completed',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('syncRestockedProducts string keys match number grocyProductId via in operator', async () => {
      // syncRestockedProducts keys are strings (from JSON serialization)
      // Object.keys(previousAmounts) also produces strings, then .map(Number) converts them
      // The `in` operator with `grocyProductId in state.syncRestockedProducts` coerces
      // the number to a string for property lookup, so this should work.
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({
          grocyBelowMinStock: { 101: 2 },
          syncRestockedProducts: { '101': new Date().toISOString() },
        }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // The number 101 should match the string key '101' via `in` operator
      expect(mockedDelete).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedCreate).not.toHaveBeenCalled();
    });

    it('ignores checked items on Mealie list and creates new item', async () => {
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      // Only a CHECKED item exists for this food
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 1, checked: true }),
      ]);

      await pollGrocyForMissingStock();

      // Checked item should be ignored -> treated as no existing item -> create new
      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith({
        shoppingListId: SHOPPING_LIST_ID,
        foodId: 'food-1',
        unitId: undefined,
        quantity: 2,
        checked: false,
      });
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it('does not adjust when amount has not changed (delta 0 filtered by !== check)', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyBelowMinStock: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })],
      });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // Same amount (2 === 2), filtered out by !== check, no adjustment
      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();
    });

    it('passes large quantities through unmodified', async () => {
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [mockMissingProduct({ id: 101, amount_missing: 99999 })],
      });
      mockedFetchItems.mockResolvedValue([]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 99999 }),
      );
    });

    it('saves correct grocyBelowMinStock after poll with multiple products', async () => {
      const mapping202 = mockProductMapping({
        id: 'mapping-2',
        mealieFoodId: 'food-2',
        mealieFoodName: 'Butter',
        grocyProductId: 202,
      });

      // Return the right mapping per table query
      mockFrom.mockImplementation((table: unknown) => {
        return {
          where: () => ({
            limit: () => {
              if (table === productMappings) {
                // We alternate between products; since both are newly missing,
                // the first call is for 101 and the second for 202.
                // For simplicity, we return a generic mapping that works for both.
                // Actually, the query uses eq(productMappings.grocyProductId, grocyProductId),
                // but since eq is a real drizzle function operating on mocked data,
                // we just need to return something. Let's track call count.
                const callIndex = mockFrom.mock.calls.filter(c => c[0] === productMappings).length;
                if (callIndex <= 1) return Promise.resolve([DEFAULT_MAPPING]);
                return Promise.resolve([mapping202]);
              }
              return Promise.resolve([]);
            },
          }),
        };
      });

      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: 10 },
        { id: 202, name: 'Butter', qu_id_stock: 10, qu_id_purchase: 10 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [
          mockMissingProduct({ id: 101, amount_missing: 2 }),
          mockMissingProduct({ id: 202, name: 'Butter', amount_missing: 5 }),
        ],
      });

      await pollGrocyForMissingStock();

      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocyBelowMinStock).toEqual({ 101: 2, 202: 5 });
      expect(savedState.lastGrocyPoll).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // syncParentOwnStock behaviour
  // -------------------------------------------------------------------------

  describe('syncParentOwnStock', () => {
    beforeEach(() => {
      mockedResolveSyncSubProducts.mockResolvedValue(true);
      mockedResolveSyncParentOwnStock.mockResolvedValue(true);
      setupDbMock([DEFAULT_MAPPING], []);
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null, min_stock_amount: 2 },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101, min_stock_amount: 0 },
      ] as any);
    });

    it('adds parent to shopping list when own stock is below min and aggregate is not missing', async () => {
      // Nothing aggregate-missing; parent own stock is 0 vs min 2
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedGetCurrentStock.mockResolvedValue([{ product_id: 101, amount: 0 }] as any);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ foodId: 'food-1', quantity: 2 }),
      );
    });

    it('keeps the previous parent deficit when the parent shortage cannot be written', async () => {
      mockedGetGrocyEntities.mockImplementation((async (entity: string) => entity === 'quantity_units'
        ? [{ id: 14, name: 'kilogram' }, { id: 9, name: 'zak' }]
        : [
          { id: 101, name: 'Flour', qu_id_stock: 14, qu_id_purchase: 9, parent_product_id: null, min_stock_amount: 2 },
          { id: 104, name: 'Wheat flour', qu_id_stock: 14, qu_id_purchase: 9, parent_product_id: 101, min_stock_amount: 0 },
        ]) as any);
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedGetCurrentStock.mockResolvedValue([{ product_id: 101, amount: 0 }] as any);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      const saved = mockedSaveSyncState.mock.calls.at(-1)![0];
      expect(saved.grocyParentOwnStockDeficit).toEqual({});
    });

    it('applies cross-poll delta using previous grocyParentOwnStockDeficit', async () => {
      // Previous poll stored a deficit of 2 for parent 101; now own stock rose to 1 → deficit 1
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyParentOwnStockDeficit: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedGetCurrentStock.mockResolvedValue([{ product_id: 101, amount: 1 }] as any);
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // effectiveCurrent=1, effectivePrevious=2, delta=-1, existing qty=2 → new qty=1
      expect(mockedUpdate).toHaveBeenCalledOnce();
      expect(mockedUpdate).toHaveBeenCalledWith('mealie-item-1', expect.objectContaining({ quantity: 1 }));
    });

    it('removes prior own-stock contribution and clears stored deficit when feature is disabled', async () => {
      // Feature was on last poll (deficit=2 stored); now turned off
      mockedResolveSyncParentOwnStock.mockResolvedValue(false);
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyParentOwnStockDeficit: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // Previous deficit (2) treated as "was missing", nothing currently missing → delta -2 → delete
      expect(mockedDelete).toHaveBeenCalledOnce();
      expect(mockedDelete).toHaveBeenCalledWith('mealie-item-1');

      // Stored deficit must be cleared
      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocyParentOwnStockDeficit).toEqual({});
    });

    it('preserves grocyParentOwnStockDeficit and makes no quantity changes when getCurrentStock throws', async () => {
      mockedGetSyncState.mockResolvedValue(
        mockSyncState({ grocyParentOwnStockDeficit: { 101: 2 } }),
      );
      mockedGetVolatileStock.mockResolvedValue({ missing_products: [] });
      mockedGetCurrentStock.mockRejectedValue(new Error('stock API down'));
      mockedFetchItems.mockResolvedValue([
        mockMealieShoppingItem({ id: 'mealie-item-1', foodId: 'food-1', quantity: 2, checked: false }),
      ]);

      await pollGrocyForMissingStock();

      // No quantity changes — the item should not be removed or adjusted
      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockedDelete).not.toHaveBeenCalled();

      // Stored deficit must be preserved for the next poll
      expect(mockedSaveSyncState).toHaveBeenCalledOnce();
      const savedState = mockedSaveSyncState.mock.calls[0][0];
      expect(savedState.grocyParentOwnStockDeficit).toEqual({ 101: 2 });

      expect(vi.mocked(log.warn)).toHaveBeenCalledWith(
        expect.stringContaining('Could not check parent product own stock'),
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Sub-product log behaviour
  // -------------------------------------------------------------------------

  describe('sub-product logging', () => {
    beforeEach(() => {
      mockedResolveSyncSubProducts.mockResolvedValue(true);
      setupDbMock([DEFAULT_MAPPING], []);
    });

    it('logs "resolved to parent" when sub-product is newly missing', async () => {
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [{ id: 104, name: 'Volle Melk', amount_missing: 1, is_partly_in_stock: 0 }],
      });
      // Sub-product not previously missing
      mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: {} }));

      await pollGrocyForMissingStock();

      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        expect.stringContaining('resolved to parent "Milk"'),
      );
    });

    it('does not log "resolved to parent" when sub-product was already missing with same parent', async () => {
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [{ id: 104, name: 'Volle Melk', amount_missing: 1, is_partly_in_stock: 0 }],
      });
      // Sub-product was already missing in previous poll, same parent
      mockedGetSyncState.mockResolvedValue(mockSyncState({
        grocyBelowMinStock: { 104: 1 },
        grocyEffectiveParentByOriginalId: { 104: 101 },
      }));

      await pollGrocyForMissingStock();

      expect(vi.mocked(log.info)).not.toHaveBeenCalledWith(
        expect.stringContaining('resolved to parent'),
      );
    });

    it('logs "combined" message only when the shopping list item is created', async () => {
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null },
        { id: 103, name: 'Koffiemelk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [
          { id: 103, name: 'Koffiemelk', amount_missing: 1, is_partly_in_stock: 0 },
          { id: 104, name: 'Volle Melk', amount_missing: 1, is_partly_in_stock: 0 },
        ],
      });
      mockedFetchItems.mockResolvedValue([]);
      mockedCreate.mockResolvedValue({} as any);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        expect.stringContaining('combined into 1 list item'),
      );
    });

    it('includes parent product in note when parent and sub-product are both missing (parent first in list)', async () => {
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [
          // Parent first, then child
          { id: 101, name: 'Milk', amount_missing: 1, is_partly_in_stock: 0 },
          { id: 104, name: 'Volle Melk', amount_missing: 2, is_partly_in_stock: 0 },
        ],
      });
      mockedFetchItems.mockResolvedValue([]);
      mockedCreate.mockResolvedValue({} as any);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          note: '1× Milk | 2× Volle Melk',
        }),
      );
    });

    it('includes parent product in note when parent and sub-product are both missing (sub-product first in list)', async () => {
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [
          // Child first, then parent
          { id: 104, name: 'Volle Melk', amount_missing: 2, is_partly_in_stock: 0 },
          { id: 101, name: 'Milk', amount_missing: 1, is_partly_in_stock: 0 },
        ],
      });
      mockedFetchItems.mockResolvedValue([]);
      mockedCreate.mockResolvedValue({} as any);

      await pollGrocyForMissingStock();

      expect(mockedCreate).toHaveBeenCalledOnce();
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 3,
          note: expect.stringContaining('1× Milk'),
        }),
      );
    });

    it('does not log "combined" message on unchanged subsequent poll', async () => {
      const existingItem = mockMealieShoppingItem({
        id: 'mealie-milk',
        foodId: 'food-1',
        checked: false,
        quantity: 2,
      });
      mockedGetGrocyEntities.mockResolvedValue([
        { id: 101, name: 'Milk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: null },
        { id: 103, name: 'Koffiemelk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
        { id: 104, name: 'Volle Melk', qu_id_stock: 10, qu_id_purchase: null, parent_product_id: 101 },
      ] as any);
      mockedGetVolatileStock.mockResolvedValue({
        missing_products: [
          { id: 103, name: 'Koffiemelk', amount_missing: 1, is_partly_in_stock: 0 },
          { id: 104, name: 'Volle Melk', amount_missing: 1, is_partly_in_stock: 0 },
        ],
      });
      // Both already missing — same amount as before
      mockedGetSyncState.mockResolvedValue(mockSyncState({
        grocyBelowMinStock: { 103: 1, 104: 1 },
        grocyEffectiveParentByOriginalId: { 103: 101, 104: 101 },
      }));
      mockedFetchItems.mockResolvedValue([existingItem]);

      await pollGrocyForMissingStock();

      expect(mockedCreate).not.toHaveBeenCalled();
      expect(vi.mocked(log.info)).not.toHaveBeenCalledWith(
        expect.stringContaining('combined into 1 list item'),
      );
    });
  });

  it('records the actual shopping list quantity change and its stock-shortage cause', async () => {
    mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 2 } }));
    mockedGetVolatileStock.mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 4 })] });
    mockedFetchItems.mockResolvedValue([mockMealieShoppingItem({ id: 'milk-item', foodId: DEFAULT_MAPPING.mealieFoodId, checked: false, quantity: 3 })]);
    const result = await pollGrocyForMissingStock();
    expect(result.events).toEqual([expect.objectContaining({
      kind: 'mutation', source: 'Grocy', target: 'Mealie', productName: DEFAULT_MAPPING.grocyProductName,
      reason: "Grocy's stock shortage changed from 2 to 4.",
      details: expect.objectContaining({ before: 3, after: 5, deficit: 4, mealieItemId: 'milk-item' }),
    })]);
  });

  it('does not record a mutation for an unchanged item that is already on the list', async () => {
    mockedResolveEnsureLowStockOnMealieList.mockResolvedValue(true);
    mockedGetSyncState.mockResolvedValue(mockSyncState({ grocyBelowMinStock: { 101: 2 } }));
    mockedGetVolatileStock.mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });
    mockedFetchItems.mockResolvedValue([mockMealieShoppingItem({ foodId: DEFAULT_MAPPING.mealieFoodId, checked: false, quantity: 2 })]);
    const result = await pollGrocyForMissingStock();
    expect(result.events).toEqual([]);
  });

  it('keeps a successful shopping list write if saving sync state subsequently fails', async () => {
    mockedGetVolatileStock.mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });
    mockedSaveSyncState.mockRejectedValueOnce(new Error('State write failed'));
    const result = await pollGrocyForMissingStock();
    expect(result.status).toBe('error');
    expect(result.events).toEqual([
      expect.objectContaining({ kind: 'mutation', details: expect.objectContaining({ before: 0, after: 2 }) }),
      expect.objectContaining({ kind: 'issue', message: expect.stringContaining('State write failed') }),
    ]);
  });

  it('records a distinct state-save failure after an in-possession error', async () => {
    mockedSyncMealieInPossessionFromGrocy.mockResolvedValueOnce({
      status: 'error',
      error: 'Product update failed',
      summary: { processedProducts: 1, updatedProducts: 0, enabledProducts: 0, disabledProducts: 0, unchangedProducts: 0, failedProducts: 1 },
      events: [{ kind: 'issue', category: 'inventory', level: 'error', message: 'Product update failed', productName: 'Milk' }],
    });
    mockedSaveSyncState.mockRejectedValueOnce(new Error('State write failed'));
    const result = await pollGrocyForMissingStock();
    expect(result.status).toBe('error');
    expect(result.events).toEqual([
      expect.objectContaining({ kind: 'issue', message: 'Product update failed' }),
      expect.objectContaining({ kind: 'issue', message: expect.stringContaining('State write failed') }),
    ]);
  });

  it('records a shopping-list exception only once when it reaches the outer catch', async () => {
    mockedGetVolatileStock.mockResolvedValue({ missing_products: [mockMissingProduct({ id: 101, amount_missing: 2 })] });
    mockedCreate.mockRejectedValueOnce(new Error('Mealie write failed'));
    const result = await pollGrocyForMissingStock();
    expect(result.status).toBe('error');
    expect(result.events).toEqual([
      expect.objectContaining({ kind: 'issue', productName: DEFAULT_MAPPING.grocyProductName, message: expect.stringContaining('Mealie write failed') }),
    ]);
  });

});
