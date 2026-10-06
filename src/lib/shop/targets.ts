import { getGrocyEntities } from '../grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '../mealie';
import { extractFoods, extractUnits } from '../mealie/types';
import { fuzzyMatch } from '../fuzzy-match';

export interface TargetOption {
  kind: 'grocy_product' | 'mealie_food';
  id: string;
  name: string;
  /** Grocy stock unit for Grocy products. */
  baseUnitId: string | null;
  baseUnitName: string | null;
}

/** Search mapping targets: Grocy products (with stock unit) and Mealie foods. */
export async function searchMappingTargets(query: string, limit = 20): Promise<{ targets: TargetOption[]; mealieUnits: Array<{ id: string; name: string }> }> {
  const [products, units, foods, mealieUnits] = await Promise.all([
    getGrocyEntities('products'),
    getGrocyEntities('quantity_units'),
    RecipesFoodsService.getAllApiFoodsGet(query || undefined, undefined, undefined, 'asc', undefined, undefined, 1, 50),
    RecipesUnitsService.getAllApiUnitsGet(undefined, undefined, undefined, 'asc', undefined, undefined, 1, 1000),
  ]);
  const unitNames = new Map(units.map(unit => [Number(unit.id), unit.name ?? `Unit #${unit.id}`]));
  const grocyTargets: TargetOption[] = products.map(product => ({
    kind: 'grocy_product',
    id: String(product.id),
    name: product.name ?? `Product #${product.id}`,
    baseUnitId: product.qu_id_stock !== undefined && product.qu_id_stock !== null ? String(product.qu_id_stock) : null,
    baseUnitName: unitNames.get(Number(product.qu_id_stock)) ?? null,
  }));
  const matchedGrocy = query
    ? fuzzyMatch(query, grocyTargets, target => target.name, 0.4, limit).map(match => match.item)
    : grocyTargets.slice(0, limit);
  const foodTargets: TargetOption[] = extractFoods(foods).slice(0, limit).map(food => ({
    kind: 'mealie_food',
    id: food.id,
    name: food.name,
    baseUnitId: null,
    baseUnitName: null,
  }));
  return {
    targets: [...matchedGrocy, ...foodTargets],
    mealieUnits: extractUnits(mealieUnits).map(unit => ({ id: unit.id, name: unit.name })),
  };
}
