import { db } from '../db';
import { productMappings } from '../db/schema';
import { getGrocyEntities } from '../grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '../mealie';
import { extractFoods, extractUnits } from '../mealie/types';
import { fuzzyMatch } from '../fuzzy-match';

export interface TargetOption {
  kind: 'grocy_product' | 'mealie_food';
  id: string;
  name: string;
  source?: 'grocy_mealie' | 'grocy' | 'mealie';
  linkedFoods?: Array<{ id: string; name: string }>;
  /** Grocy stock unit for Grocy products. */
  baseUnitId: string | null;
  baseUnitName: string | null;
}

/** Resolve an exact Grocy target; a suggestion must never guess its stock unit. */
export async function resolveGrocyMappingTarget(id: string): Promise<TargetOption | null> {
  const [products, units] = await Promise.all([
    getGrocyEntities('products'),
    getGrocyEntities('quantity_units'),
  ]);
  const product = products.find(candidate => String(candidate.id) === id);
  if (!product || !product.qu_id_stock) return null;
  const unit = units.find(candidate => String(candidate.id) === String(product.qu_id_stock));
  return {
    kind: 'grocy_product', id, name: product.name ?? `Product #${id}`,
    baseUnitId: String(product.qu_id_stock), baseUnitName: unit?.name ?? null,
  };
}

/** Search mapping targets: Grocy products (with stock unit) and Mealie foods. */
export async function searchMappingTargets(query: string, limit = 20, suggestFor = ''): Promise<{ targets: TargetOption[]; mealieUnits: Array<{ id: string; name: string }> }> {
  const [products, units, foods, mealieUnits] = await Promise.all([
    getGrocyEntities('products'),
    getGrocyEntities('quantity_units'),
    RecipesFoodsService.getAllApiFoodsGet(query || undefined, undefined, undefined, 'asc', undefined, undefined, 1, 50),
    RecipesUnitsService.getAllApiUnitsGet(undefined, undefined, undefined, 'asc', undefined, undefined, 1, 1000),
  ]);
  const links = db.select().from(productMappings).all();
  const byFood = new Map(links.map(link => [link.mealieFoodId, link]));
  const byProduct = new Map<number, typeof links>();
  for (const link of links) byProduct.set(link.grocyProductId, [...(byProduct.get(link.grocyProductId) ?? []), link]);
  const unitNames = new Map(units.map(unit => [Number(unit.id), unit.name ?? `Unit #${unit.id}`]));
  const grocyTargets: TargetOption[] = products.map(product => ({
    kind: 'grocy_product',
    id: String(product.id),
    name: product.name ?? `Product #${product.id}`,
    source: byProduct.has(Number(product.id)) ? 'grocy_mealie' : 'grocy',
    linkedFoods: (byProduct.get(Number(product.id)) ?? []).map(link => ({ id: link.mealieFoodId, name: link.mealieFoodName })),
    baseUnitId: product.qu_id_stock !== undefined && product.qu_id_stock !== null ? String(product.qu_id_stock) : null,
    baseUnitName: unitNames.get(Number(product.qu_id_stock)) ?? null,
  }));
  const grocyById = new Map(grocyTargets.map(target => [target.id, target]));
  const labels = (target: TargetOption) => [target.name, ...(target.linkedFoods ?? []).map(food => food.name)].join(' ');
  const matchQuery = query || suggestFor;
  const matchedGrocy = matchQuery
    ? fuzzyMatch(matchQuery, grocyTargets, labels, query ? 0.4 : 0.15, limit).map(match => match.item)
    : grocyTargets.slice(0, limit);
  const combined = new Map(matchedGrocy.map(target => [target.id, target]));
  const foodTargets: TargetOption[] = [];
  const foodCandidates = !query && suggestFor ? fuzzyMatch(suggestFor, extractFoods(foods), food => food.name, 0.15, limit).map(match => match.item) : extractFoods(foods);
  for (const food of foodCandidates) {
    const link = byFood.get(food.id);
    const grocy = link && grocyById.get(String(link.grocyProductId));
    if (grocy) combined.set(grocy.id, grocy);
    else foodTargets.push({ kind: 'mealie_food', id: food.id, name: food.name, source: 'mealie', linkedFoods: [], baseUnitId: null, baseUnitName: null });
  }
  const rank = (target: TargetOption) => target.source === 'grocy_mealie' ? 0 : target.kind === 'grocy_product' ? 1 : 2;
  const targets = [...combined.values(), ...foodTargets].sort((a, b) => rank(a) - rank(b)).filter((target, index, all) => all.slice(0, index).filter(candidate => rank(candidate) === rank(target)).length < limit);
  return {
    targets,
    mealieUnits: extractUnits(mealieUnits).map(unit => ({ id: unit.id, name: unit.name })),
  };
}
