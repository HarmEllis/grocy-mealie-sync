import { db } from '../db';
import { productMappings } from '../db/schema';
import { getGrocyEntities } from '../grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '../mealie';
import { extractFoods, extractUnits, type MealieFood, type MealieUnit } from '../mealie/types';
import { listRetailerMappings } from './retailer-catalog';
import type { TargetOption } from './targets';

export type ProductSource = 'all' | 'grocy_mealie' | 'grocy' | 'mealie';
export interface InventoryOptions {
  query?: string;
  source?: ProductSource;
  mapped?: 'all' | 'mapped' | 'unmapped';
  providerId?: string;
  offset?: number;
  limit?: number;
  refresh?: boolean;
}

/** Follow upstream pagination rather than silently dropping foods after page one. */
async function allFoods(): Promise<MealieFood[]> {
  const foods: MealieFood[] = [];
  for (let page = 1; ; page++) {
    const response = await RecipesFoodsService.getAllApiFoodsGet(undefined, undefined, undefined, 'asc', undefined, undefined, page, 1000);
    const batch = extractFoods(response);
    foods.push(...batch);
    if (response.total_pages !== undefined ? page >= response.total_pages : !response.next && batch.length < 1000) break;
    if (!batch.length || page >= 10_000) throw new Error('Mealie food pagination did not complete');
  }
  return foods;
}

export async function loadAllMealieUnits(): Promise<MealieUnit[]> {
  const units: MealieUnit[] = [];
  for (let page = 1; ; page++) {
    const response = await RecipesUnitsService.getAllApiUnitsGet(undefined, undefined, undefined, 'asc', undefined, undefined, page, 1000);
    const batch = extractUnits(response);
    units.push(...batch);
    if (response.total_pages !== undefined ? page >= response.total_pages : !response.next && batch.length < 1000) break;
    if (!batch.length || page >= 10_000) throw new Error('Mealie unit pagination did not complete');
  }
  return units;
}

async function loadSnapshot() {
  return Promise.all([getGrocyEntities('products'), getGrocyEntities('quantity_units'), allFoods(), loadAllMealieUnits()]);
}

declare global {
  // Share a short metadata snapshot across route bundles; mappings are always read fresh.
  // eslint-disable-next-line no-var
  var __gmsShopProductInventory: { expiresAt: number; promise: ReturnType<typeof loadSnapshot> } | undefined;
}

export function clearProductInventoryCache() { globalThis.__gmsShopProductInventory = undefined; }

async function readSnapshot(refresh: boolean) {
  const hit = globalThis.__gmsShopProductInventory;
  if (!refresh && hit && hit.expiresAt > Date.now()) return hit.promise;
  const entry = { expiresAt: Date.now() + 30_000, promise: loadSnapshot() };
  globalThis.__gmsShopProductInventory = entry;
  try { return await entry.promise; }
  catch (error) {
    if (globalThis.__gmsShopProductInventory === entry) clearProductInventoryCache();
    throw error;
  }
}

/** One canonical row per own product, with linked Mealie foods folded into Grocy. */
export async function productInventory(options: InventoryOptions = {}, useCache = false) {
  const [products, units, foods, mealieUnits] = await (useCache ? readSnapshot(Boolean(options.refresh)) : loadSnapshot());
  const activeFoods = new Map(foods.map(food => [food.id, food.name]));
  const links = db.select().from(productMappings).all().filter(link => activeFoods.has(link.mealieFoodId));
  const grocyIds = new Set(products.map(product => String(product.id)));
  const linkedFoods = new Set(links.filter(link => grocyIds.has(String(link.grocyProductId))).map(link => link.mealieFoodId));
  const names = new Map(units.map(unit => [String(unit.id), unit.name ?? null]));
  const mappings = listRetailerMappings();
  const targets: TargetOption[] = products.map(product => {
    const linked = links.filter(link => String(link.grocyProductId) === String(product.id));
    const baseUnitId = product.qu_id_stock == null ? null : String(product.qu_id_stock);
    return {
      kind: 'grocy_product', id: String(product.id), name: product.name ?? `Product #${product.id}`,
      source: linked.length ? 'grocy_mealie' : 'grocy',
      linkedFoods: linked.map(link => ({ id: link.mealieFoodId, name: activeFoods.get(link.mealieFoodId) ?? link.mealieFoodName })),
      baseUnitId, baseUnitName: names.get(baseUnitId ?? '') ?? null,
    };
  });
  for (const food of foods) {
    if (linkedFoods.has(food.id)) continue;
    const ownMappings = mappings.filter(mapping => mapping.targetKind === 'mealie_food' && mapping.targetId === food.id);
    const unitIds = new Set(ownMappings.map(mapping => mapping.packageBaseUnitId));
    const baseUnitId = unitIds.size === 1 ? ownMappings[0].packageBaseUnitId : null;
    targets.push({
      kind: 'mealie_food', id: food.id, name: food.name, source: 'mealie', linkedFoods: [],
      baseUnitId, baseUnitName: unitIds.size > 1 ? 'Different units per shop' : ownMappings.length && baseUnitId === null ? 'Count' : mealieUnits.find(unit => unit.id === baseUnitId)?.name ?? null,
    });
  }
  const key = (target: TargetOption) => `${target.kind}:${target.id}`;
  const canonicalKey = (mapping: (typeof mappings)[number]) => {
    const linked = mapping.targetKind === 'mealie_food' ? links.find(link => link.mealieFoodId === mapping.targetId && grocyIds.has(String(link.grocyProductId))) : undefined;
    return linked ? `grocy_product:${linked.grocyProductId}` : `${mapping.targetKind}:${mapping.targetId}`;
  };
  const mapped = new Set(mappings.filter(mapping => mapping.role === 'preferred' && (!options.providerId || mapping.providerId === options.providerId)).map(canonicalKey));
  const counts = {
    all: targets.length, grocy_mealie: targets.filter(target => target.source === 'grocy_mealie').length,
    grocy: targets.filter(target => target.source === 'grocy').length,
    mealie: targets.filter(target => target.source === 'mealie').length,
    mapped: targets.filter(target => mapped.has(key(target))).length,
    unmapped: targets.filter(target => !mapped.has(key(target))).length,
  };
  const needle = options.query?.trim().toLocaleLowerCase() ?? '';
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const rank = (target: TargetOption) => target.source === 'grocy_mealie' ? 0 : target.source === 'grocy' ? 1 : 2;
  const filtered = targets.filter(target =>
    (!options.source || options.source === 'all' || target.source === options.source)
    && (!options.mapped || options.mapped === 'all' || mapped.has(key(target)) === (options.mapped === 'mapped'))
    && (!needle || [target.name, ...(target.linkedFoods ?? []).map(food => food.name)].join(' ').toLocaleLowerCase().includes(needle)),
  ).sort((a, b) => rank(a) - rank(b) || collator.compare(a.name, b.name) || collator.compare(a.id, b.id));
  const offset = options.offset ?? 0;
  return { targets: filtered.slice(offset, offset + (options.limit ?? 50)), total: filtered.length, offset, counts, mealieUnits: mealieUnits.map(unit => ({ id: unit.id, name: unit.name })) };
}
