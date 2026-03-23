import type { ShoppingListItemOut_Output } from '../../../mealie/client/models/ShoppingListItemOut_Output';
import type { GrocyMissingProduct } from '../../../grocy/types';
import type { SyncStateData } from '../../state';

export function mockMealieShoppingItem(
  overrides: Partial<ShoppingListItemOut_Output> = {},
): ShoppingListItemOut_Output {
  return {
    id: 'mealie-item-1',
    shoppingListId: 'list-1',
    groupId: 'group-1',
    householdId: 'household-1',
    checked: false,
    quantity: 1,
    foodId: 'food-1',
    note: null,
    display: 'Test Item',
    ...overrides,
  };
}

export function mockProductMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mapping-1',
    mealieFoodId: 'food-1',
    mealieFoodName: 'Milk',
    grocyProductId: 101,
    grocyProductName: 'Milk',
    unitMappingId: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function mockUnitMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-mapping-1',
    mealieUnitId: 'mealie-unit-1',
    mealieUnitName: 'Liter',
    mealieUnitAbbreviation: 'L',
    grocyUnitId: 10,
    grocyUnitName: 'Liter',
    conversionFactor: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function mockSyncState(overrides: Partial<SyncStateData> = {}): SyncStateData {
  return {
    lastGrocyPoll: null,
    lastMealiePoll: null,
    grocyBelowMinStock: {},
    mealieCheckedItems: {},
    syncRestockedProducts: {},
    ...overrides,
  };
}

export function mockGrocyShoppingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    shopping_list_id: 1,
    product_id: 101,
    note: '',
    amount: 1,
    ...overrides,
  };
}

export function mockMissingProduct(overrides: Partial<GrocyMissingProduct> = {}): GrocyMissingProduct {
  return {
    id: 101,
    name: 'Milk',
    amount_missing: 2,
    is_partly_in_stock: 0,
    ...overrides,
  };
}
