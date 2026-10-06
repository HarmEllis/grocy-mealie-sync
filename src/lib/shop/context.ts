import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { getGrocyEntities, type GrocyProductWithParent } from '../grocy/types';
import { RecipesUnitsService } from '../mealie';
import { extractUnits } from '../mealie/types';
import { emptyUnitContext, type UnitContext } from './units';

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Load the Grocy and Mealie metadata needed to convert demand and receipt amounts. */
export async function loadUnitContext(): Promise<UnitContext> {
  const ctx = emptyUnitContext();
  const [products, units, conversions, mealieUnits] = await Promise.all([
    getGrocyEntities('products'),
    getGrocyEntities('quantity_units'),
    getGrocyEntities('quantity_unit_conversions'),
    RecipesUnitsService.getAllApiUnitsGet(undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000),
  ]);
  for (const raw of products as GrocyProductWithParent[]) {
    const id = Number(raw.id);
    if (!Number.isFinite(id)) continue;
    ctx.grocyProducts.set(id, {
      id,
      name: raw.name ?? `Product #${id}`,
      quIdStock: numberOrNull(raw.qu_id_stock),
      quIdPurchase: numberOrNull(raw.qu_id_purchase),
      parentProductId: numberOrNull(raw.parent_product_id),
      noOwnStock: Number(raw.no_own_stock ?? 0) !== 0,
    });
  }
  for (const unit of units) {
    const id = Number(unit.id);
    if (Number.isFinite(id)) ctx.grocyUnitNames.set(id, unit.name ?? `Unit #${id}`);
  }
  for (const conversion of conversions) {
    const fromQuId = Number(conversion.from_qu_id);
    const toQuId = Number(conversion.to_qu_id);
    const factor = Number(conversion.factor);
    if (!Number.isFinite(fromQuId) || !Number.isFinite(toQuId) || !(factor > 0)) continue;
    ctx.grocyConversions.push({ fromQuId, toQuId, factor, productId: numberOrNull(conversion.product_id) });
  }
  for (const unit of extractUnits(mealieUnits)) {
    ctx.mealieUnits.set(unit.id, {
      id: unit.id,
      name: unit.name,
      abbreviation: unit.abbreviation ?? null,
      standardUnit: unit.standardUnit ?? null,
      standardQuantity: unit.standardQuantity ?? null,
    });
  }
  for (const mapping of db.select().from(unitMappings).all()) {
    ctx.unitMappings.set(mapping.mealieUnitId, { grocyUnitId: mapping.grocyUnitId, factor: mapping.conversionFactor });
  }
  for (const mapping of db.select().from(productMappings).all()) {
    ctx.foodToGrocyProduct.set(mapping.mealieFoodId, mapping.grocyProductId);
    ctx.mealieFoodNames.set(mapping.mealieFoodId, mapping.mealieFoodName);
  }
  return ctx;
}
