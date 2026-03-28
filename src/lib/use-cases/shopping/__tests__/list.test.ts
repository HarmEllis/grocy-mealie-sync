import { describe, expect, it } from 'vitest';
import { mockMealieShoppingItem } from '@/lib/sync/__tests__/helpers/mocks';
import {
  addShoppingListItem,
  checkShoppingListProduct,
  getShoppingListItemsResource,
  removeShoppingListItem,
  type ShoppingListDeps,
} from '../list';

function createDeps(overrides: Partial<ShoppingListDeps> = {}): ShoppingListDeps {
  return {
    resolveShoppingListId: async () => 'list-1',
    fetchShoppingItems: async () => [
      mockMealieShoppingItem({
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        quantity: 2,
        checked: false,
        display: 'Milk',
        food: { id: 'food-1', name: 'Milk' } as never,
        unitId: 'unit-1',
        unit: { id: 'unit-1', name: 'Liter', abbreviation: 'l' } as never,
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T09:05:00.000Z',
      }),
      mockMealieShoppingItem({
        id: 'item-2',
        shoppingListId: 'list-1',
        foodId: 'food-2',
        quantity: 1,
        checked: true,
        display: 'Bread',
        food: { id: 'food-2', name: 'Bread' } as never,
        createdAt: '2026-03-29T08:00:00.000Z',
        updatedAt: '2026-03-29T08:30:00.000Z',
      }),
    ],
    createShoppingItem: async body => ({
      createdItems: [
        mockMealieShoppingItem({
          id: 'item-3',
          shoppingListId: body.shoppingListId,
          foodId: body.foodId ?? null,
          quantity: body.quantity ?? 1,
          checked: false,
          display: 'Eggs',
          food: body.foodId ? { id: body.foodId, name: 'Eggs' } as never : null,
          unitId: body.unitId ?? null,
          createdAt: '2026-03-29T10:00:00.000Z',
          updatedAt: '2026-03-29T10:00:00.000Z',
        }),
      ],
    }),
    updateShoppingItem: async (itemId, body) => ({
      updatedItems: [
        mockMealieShoppingItem({
          id: itemId,
          shoppingListId: body.shoppingListId,
          foodId: body.foodId ?? null,
          quantity: body.quantity ?? 1,
          checked: body.checked ?? false,
          display: 'Milk',
          food: body.foodId ? { id: body.foodId, name: 'Milk' } as never : null,
          unitId: body.unitId ?? null,
          createdAt: '2026-03-29T09:00:00.000Z',
          updatedAt: '2026-03-29T10:10:00.000Z',
        }),
      ],
    }),
    deleteShoppingItem: async itemId => ({
      removed: true,
      itemId,
    }),
    ...overrides,
  };
}

describe('shopping list use-cases', () => {
  it('returns the configured shopping list with counts and normalized items', async () => {
    const result = await getShoppingListItemsResource(createDeps());

    expect(result).toEqual({
      shoppingListId: 'list-1',
      configured: true,
      counts: {
        total: 2,
        unchecked: 1,
        checked: 1,
      },
      items: [
        {
          id: 'item-1',
          shoppingListId: 'list-1',
          foodId: 'food-1',
          foodName: 'Milk',
          unitId: 'unit-1',
          unitName: 'Liter',
          quantity: 2,
          checked: false,
          note: null,
          display: 'Milk',
          createdAt: '2026-03-29T09:00:00.000Z',
          updatedAt: '2026-03-29T09:05:00.000Z',
        },
        {
          id: 'item-2',
          shoppingListId: 'list-1',
          foodId: 'food-2',
          foodName: 'Bread',
          unitId: null,
          unitName: null,
          quantity: 1,
          checked: true,
          note: null,
          display: 'Bread',
          createdAt: '2026-03-29T08:00:00.000Z',
          updatedAt: '2026-03-29T08:30:00.000Z',
        },
      ],
    });
  });

  it('checks whether a product is already on the shopping list by foodId', async () => {
    const result = await checkShoppingListProduct(
      { foodId: 'food-1' },
      createDeps(),
    );

    expect(result).toEqual({
      shoppingListId: 'list-1',
      alreadyOnList: true,
      matchCount: 1,
      matches: [
        {
          id: 'item-1',
          shoppingListId: 'list-1',
          foodId: 'food-1',
          foodName: 'Milk',
          unitId: 'unit-1',
          unitName: 'Liter',
          quantity: 2,
          checked: false,
          note: null,
          display: 'Milk',
          createdAt: '2026-03-29T09:00:00.000Z',
          updatedAt: '2026-03-29T09:05:00.000Z',
          score: 100,
        },
      ],
    });
  });

  it('merges into an existing unchecked item by default when adding a duplicate food', async () => {
    const result = await addShoppingListItem(
      { foodId: 'food-1', quantity: 3, unitId: 'unit-1' },
      createDeps(),
    );

    expect(result).toEqual({
      action: 'updated',
      merged: true,
      item: {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: 'unit-1',
        unitName: null,
        quantity: 5,
        checked: false,
        note: null,
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T10:10:00.000Z',
      },
    });
  });

  it('creates a new shopping list item when there is no unchecked duplicate', async () => {
    const result = await addShoppingListItem(
      { foodId: 'food-3', quantity: 2 },
      createDeps(),
    );

    expect(result).toEqual({
      action: 'created',
      merged: false,
      item: {
        id: 'item-3',
        shoppingListId: 'list-1',
        foodId: 'food-3',
        foodName: 'Eggs',
        unitId: null,
        unitName: null,
        quantity: 2,
        checked: false,
        note: null,
        display: 'Eggs',
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
      },
    });
  });

  it('removes an item from the configured shopping list', async () => {
    const result = await removeShoppingListItem(
      { itemId: 'item-1' },
      createDeps(),
    );

    expect(result).toEqual({
      removed: true,
      itemId: 'item-1',
    });
  });
});
