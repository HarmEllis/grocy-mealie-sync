/**
 * Typed helpers for Mealie API responses.
 *
 * The generated Mealie pagination types (IngredientFoodPagination, etc.)
 * already have properly typed `items` arrays. However, some parts of the
 * codebase cast responses with `(res as any).items` because of minor type
 * mismatches or missing imports. These helpers provide a clean extraction
 * layer so application code can avoid `as any` entirely.
 */

import type { IngredientFoodPagination } from './client/models/IngredientFoodPagination';
import type { IngredientUnitPagination } from './client/models/IngredientUnitPagination';
import type { ShoppingListItemPagination } from './client/models/ShoppingListItemPagination';
import type { IngredientFood_Output } from './client/models/IngredientFood_Output';
import type { IngredientUnit_Output } from './client/models/IngredientUnit_Output';
import type { ShoppingListItemOut_Output } from './client/models/ShoppingListItemOut_Output';

// ---------------------------------------------------------------------------
// Pagination item extractors
// ---------------------------------------------------------------------------

/**
 * Safely extract items from a Mealie food pagination response.
 */
export function extractFoods(res: IngredientFoodPagination): IngredientFood_Output[] {
  return res.items ?? [];
}

/**
 * Safely extract items from a Mealie unit pagination response.
 */
export function extractUnits(res: IngredientUnitPagination): IngredientUnit_Output[] {
  return res.items ?? [];
}

/**
 * Safely extract items from a Mealie shopping list item pagination response.
 */
export function extractShoppingItems(res: ShoppingListItemPagination): ShoppingListItemOut_Output[] {
  return res.items ?? [];
}

// Re-export model types that are commonly used in application code
export type {
  IngredientFood_Output as MealieFood,
  IngredientUnit_Output as MealieUnit,
  ShoppingListItemOut_Output as MealieShoppingItem,
  IngredientFoodPagination,
  IngredientUnitPagination,
  ShoppingListItemPagination,
};
