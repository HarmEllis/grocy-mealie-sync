import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  productMappingsTable: { __table: 'product_mappings' },
  mappingsRows: [] as Array<Record<string, unknown>>,
  grocyProducts: [] as Array<Record<string, unknown>>,
  currentStock: [] as Array<Record<string, unknown>>,
  foodsById: {} as Record<string, Record<string, unknown>>,
  syncEnabled: true,
  onlyAboveMinStock: false,
  loggedInUser: {
    householdSlug: 'family',
  },
  getSyncState: vi.fn(),
  saveSyncState: vi.fn(),
  updateFood: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../db/schema', () => ({
  productMappings: mockState.productMappingsTable,
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async (table: unknown) => {
        if (table === mockState.productMappingsTable) {
          return mockState.mappingsRows;
        }

        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
  },
}));

vi.mock('../../grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'products') {
      return mockState.grocyProducts;
    }

    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
  getCurrentStock: vi.fn(async () => mockState.currentStock),
}));

vi.mock('../../mealie', () => ({
  RecipesFoodsService: {
    getOneApiFoodsItemIdGet: vi.fn(async (foodId: string) => {
      const food = mockState.foodsById[foodId];
      if (!food) {
        throw new Error(`Unexpected food: ${foodId}`);
      }
      return food;
    }),
    updateOneApiFoodsItemIdPut: mockState.updateFood,
  },
  UsersCrudService: {
    getLoggedInUserApiUsersSelfGet: vi.fn(async () => mockState.loggedInUser),
  },
}));

vi.mock('../../settings', () => ({
  resolveSyncMealieInPossession: vi.fn(async () => mockState.syncEnabled),
  resolveMealieInPossessionOnlyAboveMinStock: vi.fn(async () => mockState.onlyAboveMinStock),
}));

vi.mock('../state', () => ({
  getSyncState: mockState.getSyncState,
  saveSyncState: mockState.saveSyncState,
}));

vi.mock('../../logger', () => ({
  log: {
    info: mockState.logInfo,
    warn: mockState.logWarn,
    error: mockState.logError,
  },
}));

import {
  buildUpdatedHouseholdsWithIngredientFood,
  reconcileMealieInPossessionFromGrocy,
  shouldMarkFoodInPossession,
  syncMealieInPossessionFromGrocy,
} from '../mealie-in-possession';

function createFood(overrides: Record<string, unknown> = {}) {
  return {
    id: 'food-1',
    name: 'Milk',
    pluralName: null,
    description: '',
    extras: {},
    labelId: null,
    aliases: [],
    householdsWithIngredientFood: [],
    ...overrides,
  };
}

describe('mealie in-possession sync', () => {
  beforeEach(() => {
    mockState.mappingsRows = [
      {
        grocyProductId: 101,
        grocyProductName: 'Milk',
        mealieFoodId: 'food-1',
        mealieFoodName: 'Milk',
      },
    ];
    mockState.grocyProducts = [
      { id: 101, name: 'Milk', min_stock_amount: 1 },
    ];
    mockState.currentStock = [
      { product_id: 101, amount: 2, amount_aggregated: 2 },
    ];
    mockState.foodsById = {
      'food-1': createFood(),
    };
    mockState.syncEnabled = true;
    mockState.onlyAboveMinStock = false;
    mockState.loggedInUser = { householdSlug: 'family' };
    mockState.getSyncState.mockReset();
    mockState.saveSyncState.mockReset();
    mockState.updateFood.mockReset();
    mockState.logInfo.mockClear();
    mockState.logWarn.mockClear();
    mockState.logError.mockClear();
  });

  it('computes desired in-possession state from stock and threshold mode', () => {
    expect(shouldMarkFoodInPossession(1, 2, false)).toBe(true);
    expect(shouldMarkFoodInPossession(2, 2, true)).toBe(false);
    expect(shouldMarkFoodInPossession(3, 2, true)).toBe(true);
  });

  it('adds and removes the household slug without duplicating entries', () => {
    expect(buildUpdatedHouseholdsWithIngredientFood(['family'], 'family', true)).toEqual(['family']);
    expect(buildUpdatedHouseholdsWithIngredientFood(['family', 'guests'], 'family', false)).toEqual(['guests']);
  });

  it('clears tracked state and skips delta sync when the feature is disabled', async () => {
    mockState.syncEnabled = false;

    const state = {
      lastGrocyPoll: null,
      lastMealiePoll: null,
      grocyBelowMinStock: {},
      mealieCheckedItems: {},
      mealieInPossessionByGrocyProduct: { '101': true },
      syncRestockedProducts: {},
    };

    const result = await syncMealieInPossessionFromGrocy(state);

    expect(result).toEqual({
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
    });
    expect(state.mealieInPossessionByGrocyProduct).toEqual({});
    expect(mockState.updateFood).not.toHaveBeenCalled();
  });

  it('updates Mealie when the desired state changed since the previous Grocy poll', async () => {
    const state = {
      lastGrocyPoll: null,
      lastMealiePoll: null,
      grocyBelowMinStock: {},
      mealieCheckedItems: {},
      mealieInPossessionByGrocyProduct: { '101': false },
      syncRestockedProducts: {},
    };

    const result = await syncMealieInPossessionFromGrocy(state);

    expect(result.status).toBe('ok');
    expect(result.summary).toEqual({
      processedProducts: 1,
      updatedProducts: 1,
      enabledProducts: 1,
      disabledProducts: 0,
      unchangedProducts: 0,
      failedProducts: 0,
    });
    expect(mockState.updateFood).toHaveBeenCalledWith('food-1', expect.objectContaining({
      householdsWithIngredientFood: ['family'],
    }));
    expect(state.mealieInPossessionByGrocyProduct).toEqual({ '101': true });
  });

  it('full reconcile ignores the scheduler toggle and removes stale in-possession flags', async () => {
    mockState.syncEnabled = false;
    mockState.currentStock = [];
    mockState.foodsById = {
      'food-1': createFood({ householdsWithIngredientFood: ['family'] }),
    };
    mockState.getSyncState.mockResolvedValue({
      lastGrocyPoll: null,
      lastMealiePoll: null,
      grocyBelowMinStock: {},
      mealieCheckedItems: {},
      mealieInPossessionByGrocyProduct: { '101': true },
      syncRestockedProducts: {},
    });

    const result = await reconcileMealieInPossessionFromGrocy();

    expect(result.status).toBe('ok');
    expect(result.summary).toEqual({
      processedProducts: 1,
      updatedProducts: 1,
      enabledProducts: 0,
      disabledProducts: 1,
      unchangedProducts: 0,
      failedProducts: 0,
    });
    expect(mockState.updateFood).toHaveBeenCalledWith('food-1', expect.objectContaining({
      householdsWithIngredientFood: [],
    }));
    expect(mockState.saveSyncState).toHaveBeenCalledTimes(1);
    expect(mockState.saveSyncState).toHaveBeenCalledWith(expect.objectContaining({
      lastGrocyPoll: expect.any(Date),
      mealieInPossessionByGrocyProduct: { '101': false },
    }));
  });

  it('uses the strict greater-than-minimum rule when configured', async () => {
    mockState.onlyAboveMinStock = true;
    mockState.currentStock = [
      { product_id: 101, amount: 1, amount_aggregated: 1 },
    ];
    mockState.foodsById = {
      'food-1': createFood({ householdsWithIngredientFood: ['family'] }),
    };

    const state = {
      lastGrocyPoll: null,
      lastMealiePoll: null,
      grocyBelowMinStock: {},
      mealieCheckedItems: {},
      mealieInPossessionByGrocyProduct: { '101': true },
      syncRestockedProducts: {},
    };

    const result = await syncMealieInPossessionFromGrocy(state);

    expect(result.summary.disabledProducts).toBe(1);
    expect(mockState.updateFood).toHaveBeenCalledWith('food-1', expect.objectContaining({
      householdsWithIngredientFood: [],
    }));
    expect(state.mealieInPossessionByGrocyProduct).toEqual({ '101': false });
  });
});
