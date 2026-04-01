import { describe, expect, it } from 'vitest';
import { mockMealieShoppingItem } from '@/lib/sync/__tests__/helpers/mocks';
import {
  addShoppingListItem,
  checkShoppingListProduct,
  getShoppingListItemsResource,
  mergeShoppingListDuplicates,
  removeShoppingListItem,
  updateShoppingListItem,
  updateShoppingItemUnit,
  type ShoppingListDeps,
} from '../list';

function createDeps(overrides: Partial<ShoppingListDeps> = {}): ShoppingListDeps {
  const defaultItems = [
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
  ];

  const fetchShoppingItems = overrides.fetchShoppingItems ?? (async () => defaultItems);

  return {
    resolveShoppingListId: async () => 'list-1',
    fetchShoppingItems,
    getShoppingItem: async itemId => {
      const items = await fetchShoppingItems('list-1');
      const item = items.find(entry => entry.id === itemId);
      if (!item) {
        throw new Error(`Shopping list item ${itemId} was not found.`);
      }
      return item;
    },
    createShoppingItem: async body => ({
      createdItems: [
        mockMealieShoppingItem({
          id: 'item-3',
          shoppingListId: body.shoppingListId,
          foodId: body.foodId ?? null,
          quantity: body.quantity ?? 1,
          checked: false,
          note: body.note ?? null,
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
          note: body.note ?? null,
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
    getProductOverview: async () => {
      throw new Error('getProductOverview not configured in test deps');
    },
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
      resolved: null,
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
      resolved: null,
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

  it('joins notes when merging into an existing unchecked duplicate item', async () => {
    const updateBodies: Array<{ itemId: string; note?: string; quantity?: number }> = [];

    const result = await addShoppingListItem(
      { foodId: 'food-1', quantity: 1, note: 'Vanille' },
      createDeps({
        fetchShoppingItems: async () => [
          mockMealieShoppingItem({
            id: 'item-1',
            shoppingListId: 'list-1',
            foodId: 'food-1',
            quantity: 2,
            checked: false,
            note: 'Magere',
            display: 'Milk',
            food: { id: 'food-1', name: 'Milk' } as never,
            createdAt: '2026-03-29T09:00:00.000Z',
            updatedAt: '2026-03-29T09:05:00.000Z',
          }),
        ],
        updateShoppingItem: async (itemId, body) => {
          updateBodies.push({ itemId, note: body.note ?? undefined, quantity: body.quantity });
          return {
            updatedItems: [
              mockMealieShoppingItem({
                id: itemId,
                shoppingListId: body.shoppingListId,
                foodId: body.foodId ?? null,
                quantity: body.quantity ?? 1,
                checked: body.checked ?? false,
                note: body.note ?? null,
                display: 'Milk',
                food: body.foodId ? { id: body.foodId, name: 'Milk' } as never : null,
                createdAt: '2026-03-29T09:00:00.000Z',
                updatedAt: '2026-03-29T10:10:00.000Z',
              }),
            ],
          };
        },
      }),
    );

    expect(updateBodies).toEqual([{ itemId: 'item-1', note: 'Magere | Vanille', quantity: 3 }]);
    expect(result.resolved).toBeNull();
    expect(result.item.note).toBe('Magere | Vanille');
  });

  it('resolves leading query words into the note when adding an item by query', async () => {
    const result = await addShoppingListItem(
      { query: 'vanille kwark', quantity: 2, note: '500g' },
      createDeps({
        getProductOverview: async ({ productRef }) => {
          if (productRef === 'vanille kwark') {
            throw new Error('Unknown product ref: vanille kwark');
          }

          if (productRef === 'kwark') {
            return {
              productRef: 'mapping:kwark-map',
              mapping: {
                id: 'kwark-map',
                mealieFoodId: 'food-kwark',
                mealieFoodName: 'Kwark',
                grocyProductId: 301,
                grocyProductName: 'Kwark',
                unitMappingId: 'unit-map-1',
              },
              grocyProduct: null,
              mealieFood: {
                id: 'food-kwark',
                name: 'Kwark',
                pluralName: null,
                aliases: [],
              },
              conversions: [],
            };
          }

          throw new Error(`Unexpected product ref lookup: ${productRef}`);
        },
      }),
    );

    expect(result).toEqual({
      action: 'created',
      merged: false,
      resolved: {
        query: 'vanille kwark',
        matchedQuery: 'kwark',
        resolution: 'suffix_note',
        productRef: 'mapping:kwark-map',
        foodId: 'food-kwark',
        foodName: 'Kwark',
        derivedNote: 'vanille',
        note: 'vanille | 500g',
      },
      item: {
        id: 'item-3',
        shoppingListId: 'list-1',
        foodId: 'food-kwark',
        foodName: 'Eggs',
        unitId: null,
        unitName: null,
        quantity: 2,
        checked: false,
        note: 'vanille | 500g',
        display: 'Eggs',
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
      },
    });
  });

  it('rejects adding a shopping item when neither foodId nor query is provided', async () => {
    await expect(addShoppingListItem(
      { quantity: 1 },
      createDeps(),
    )).rejects.toThrow('Either foodId or query must be provided.');
  });

  it('rejects adding a shopping item when both foodId and query are provided', async () => {
    await expect(addShoppingListItem(
      { foodId: 'food-1', query: 'Milk', quantity: 1 },
      createDeps(),
    )).rejects.toThrow('Provide either foodId or query, not both.');
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

  it('updates the checked state of an existing shopping list item', async () => {
    const result = await updateShoppingListItem(
      { itemId: 'item-1', checked: true },
      createDeps(),
    );

    expect(result).toEqual({
      item: {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: 'unit-1',
        unitName: null,
        quantity: 2,
        checked: true,
        note: null,
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T10:10:00.000Z',
      },
      updated: {
        checked: true,
        quantity: undefined,
      },
    });
  });

  it('updates the quantity of an existing shopping list item', async () => {
    const result = await updateShoppingListItem(
      { itemId: 'item-1', quantity: 4 },
      createDeps(),
    );

    expect(result).toEqual({
      item: {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: 'unit-1',
        unitName: null,
        quantity: 4,
        checked: false,
        note: null,
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T10:10:00.000Z',
      },
      updated: {
        checked: undefined,
        quantity: 4,
      },
    });
  });

  it('rejects shopping item updates that do not change any supported fields', async () => {
    await expect(updateShoppingListItem(
      { itemId: 'item-1' },
      createDeps(),
    )).rejects.toThrow('At least one shopping list field must be provided to update.');
  });

  it('merges duplicate unchecked shopping items for the same foodId', async () => {
    const updatedItems: Array<{ itemId: string; quantity?: number; note?: string }> = [];
    const deletedItems: string[] = [];

    const result = await mergeShoppingListDuplicates(
      { foodId: 'food-1' },
      createDeps({
        fetchShoppingItems: async () => [
          mockMealieShoppingItem({
            id: 'item-1',
            shoppingListId: 'list-1',
            foodId: 'food-1',
            quantity: 2,
            checked: false,
            note: 'Vanille',
            display: 'Milk',
            food: { id: 'food-1', name: 'Milk' } as never,
            createdAt: '2026-03-29T09:00:00.000Z',
            updatedAt: '2026-03-29T09:05:00.000Z',
          }),
          mockMealieShoppingItem({
            id: 'item-3',
            shoppingListId: 'list-1',
            foodId: 'food-1',
            quantity: 1,
            checked: false,
            note: 'Magere | vanille',
            display: 'Milk',
            food: { id: 'food-1', name: 'Milk' } as never,
            createdAt: '2026-03-29T09:10:00.000Z',
            updatedAt: '2026-03-29T09:15:00.000Z',
          }),
        ],
        updateShoppingItem: async (itemId, body) => {
          updatedItems.push({ itemId, quantity: body.quantity, note: body.note ?? undefined });
          return {
            updatedItems: [
              mockMealieShoppingItem({
                id: itemId,
                shoppingListId: body.shoppingListId,
                foodId: body.foodId ?? null,
                quantity: body.quantity ?? 1,
                checked: false,
                note: body.note ?? null,
                display: 'Milk',
                food: body.foodId ? { id: body.foodId, name: 'Milk' } as never : null,
                createdAt: '2026-03-29T09:00:00.000Z',
                updatedAt: '2026-03-29T10:10:00.000Z',
              }),
            ],
          };
        },
        deleteShoppingItem: async itemId => {
          deletedItems.push(itemId);
          return { removed: true, itemId };
        },
      }),
    );

    expect(updatedItems).toEqual([{ itemId: 'item-1', quantity: 3, note: 'Vanille | Magere' }]);
    expect(deletedItems).toEqual(['item-3']);
    expect(result).toEqual({
      merged: true,
      keptItemId: 'item-1',
      removedItemIds: ['item-3'],
      item: {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: null,
        unitName: null,
        quantity: 3,
        checked: false,
        note: 'Vanille | Magere',
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T10:10:00.000Z',
      },
    });
  });

  it('updates the unit of an existing shopping list item', async () => {
    const result = await updateShoppingItemUnit(
      { itemId: 'item-1', unitId: 'unit-2' },
      createDeps(),
    );

    expect(result).toEqual({
      item: {
        id: 'item-1',
        shoppingListId: 'list-1',
        foodId: 'food-1',
        foodName: 'Milk',
        unitId: 'unit-2',
        unitName: null,
        quantity: 2,
        checked: false,
        note: null,
        display: 'Milk',
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T10:10:00.000Z',
      },
      updated: {
        unitId: 'unit-2',
      },
    });
  });
});
