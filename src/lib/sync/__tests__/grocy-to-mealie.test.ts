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
import { getVolatileStock } from '../../grocy/types';
import { HouseholdsShoppingListItemsService } from '../../mealie';
import { resolveEnsureLowStockOnMealieList, resolveShoppingListId } from '../../settings';
import { getSyncState, saveSyncState } from '../state';
import { fetchAllMealieShoppingItems } from '../helpers';
import { log } from '../../logger';

// Type-safe mock accessors
const mockedGetVolatileStock = vi.mocked(getVolatileStock);
const mockedResolveShoppingListId = vi.mocked(resolveShoppingListId);
const mockedResolveEnsureLowStockOnMealieList = vi.mocked(resolveEnsureLowStockOnMealieList);
const mockedGetSyncState = vi.mocked(getSyncState);
const mockedSaveSyncState = vi.mocked(saveSyncState);
const mockedFetchItems = vi.mocked(fetchAllMealieShoppingItems);
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

      expect(result).toEqual({
        status: 'ok',
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

      expect(result).toEqual({
        status: 'ok',
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

    it('resolves unitId from unitMappings when mapping has unitMappingId', async () => {
      const mappingWithUnit = mockProductMapping({ unitMappingId: 'unit-mapping-1' });
      setupDbMock([mappingWithUnit], [DEFAULT_UNIT_MAPPING]);

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
      expect(mockedGetSyncState).not.toHaveBeenCalled();
      expect(mockedSaveSyncState).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: 'skipped',
        reason: 'no-shopping-list',
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
});
