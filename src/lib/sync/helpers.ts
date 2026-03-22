import { HouseholdsShoppingListItemsService } from '../mealie';
import { extractShoppingItems } from '../mealie/types';
import type { MealieShoppingItem } from '../mealie/types';

/**
 * Fetches all Mealie shopping list items for a given shopping list,
 * handling pagination so lists with more than 500 items are fully retrieved.
 */
export async function fetchAllMealieShoppingItems(shoppingListId: string): Promise<MealieShoppingItem[]> {
  const allItems: MealieShoppingItem[] = [];
  let page = 1;
  const perPage = 500;
  while (true) {
    const res = await HouseholdsShoppingListItemsService.getAllApiHouseholdsShoppingItemsGet(
      undefined, undefined, undefined,
      `shoppingListId=${shoppingListId}`,
      undefined, page, perPage
    );
    const items = extractShoppingItems(res);
    allItems.push(...items);
    if (items.length < perPage) break;
    page++;
  }
  return allItems;
}
