import type { MealieShoppingItem } from '../mealie/types';

/** A shopping row's unit: Mealie may send only the nested unit without `unitId`. */
export function shoppingItemUnitId(item: Pick<MealieShoppingItem, 'unitId' | 'unit'>): string | null {
  return item.unitId || item.unit?.id || null;
}
