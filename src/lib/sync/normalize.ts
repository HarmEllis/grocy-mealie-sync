import { db } from '../db';
import { unitMappings, productMappings } from '../db/schema';
import { getGrocyEntities, updateGrocyEntity } from '../grocy/types';
import { RecipesUnitsService, RecipesFoodsService } from '../mealie';
import { extractUnits, extractFoods } from '../mealie/types';
import type { IngredientFood_Output } from '../mealie/client/models/IngredientFood_Output';
import type { IngredientUnit_Output } from '../mealie/client/models/IngredientUnit_Output';
import { log } from '../logger';
import { eq } from 'drizzle-orm';
import {
  buildNormalizedGrocyProductUpdate,
  buildNormalizedGrocyUnitUpdate,
  buildNormalizedMealieFoodUpdate,
  buildNormalizedMealieUnitUpdate,
} from '../mapping-wizard-normalization';

async function fetchAllMealieFoods(): Promise<IngredientFood_Output[]> {
  const all: IngredientFood_Output[] = [];
  let page = 1;
  const perPage = 500;
  while (true) {
    const res = await RecipesFoodsService.getAllApiFoodsGet(
      undefined, undefined, undefined, undefined, undefined, undefined, page, perPage,
    );
    const items = extractFoods(res);
    all.push(...items);
    const totalPages = res.total_pages ?? 1;
    if (page >= totalPages || items.length === 0) break;
    page++;
  }
  log.info(`[Normalize] Fetched ${all.length} Mealie foods (${page} pages)`);
  return all;
}

async function fetchAllMealieUnits(): Promise<IngredientUnit_Output[]> {
  const all: IngredientUnit_Output[] = [];
  let page = 1;
  const perPage = 500;
  while (true) {
    const res = await RecipesUnitsService.getAllApiUnitsGet(
      undefined, undefined, undefined, undefined, undefined, undefined, page, perPage,
    );
    const items = extractUnits(res);
    all.push(...items);
    const totalPages = res.total_pages ?? 1;
    if (page >= totalPages || items.length === 0) break;
    page++;
  }
  log.info(`[Normalize] Fetched ${all.length} Mealie units (${page} pages)`);
  return all;
}

export async function normalizeUnits() {
  const [mealieUnits, grocyUnits] = await Promise.all([
    fetchAllMealieUnits(),
    getGrocyEntities('quantity_units'),
  ]);
  const existingMappings = await db.select().from(unitMappings);
  const mappedGrocyUnitIds = new Set(existingMappings.map(m => m.grocyUnitId));

  const existingUnitNames = new Set(mealieUnits.map(u => u.name));

  let normalizedMealie = 0;
  let normalizedGrocy = 0;
  const skippedDuplicates: string[] = [];

  for (const unit of mealieUnits) {
    const update = buildNormalizedMealieUnitUpdate(unit);
    if (!update) continue;

    if (existingUnitNames.has(update.name) && update.name !== unit.name) {
      skippedDuplicates.push(`"${unit.name}" → "${update.name}"`);
      continue;
    }

    try {
      await RecipesUnitsService.updateOneApiUnitsItemIdPut(unit.id, update);
      existingUnitNames.delete(unit.name);
      existingUnitNames.add(update.name);
      normalizedMealie++;

      const mapping = existingMappings.find(m => m.mealieUnitId === unit.id);
      if (mapping) {
        await db.update(unitMappings)
          .set({
            mealieUnitName: update.name,
            mealieUnitAbbreviation: update.abbreviation ?? mapping.mealieUnitAbbreviation,
          })
          .where(eq(unitMappings.mealieUnitId, unit.id));
      }
    } catch (e: any) {
      log.error(`Failed to normalize Mealie unit ${unit.id}:`, e?.body ?? e);
    }
  }

  if (skippedDuplicates.length > 0) {
    log.info(`[Normalize] Skipped ${skippedDuplicates.length} Mealie units due to name conflicts: ${skippedDuplicates.join(', ')}`);
  }

  for (const unit of grocyUnits) {
    if (!unit.id || !unit.name) continue;
    const unitIdNum = Number(unit.id);
    if (!mappedGrocyUnitIds.has(unitIdNum)) continue;

    const update = buildNormalizedGrocyUnitUpdate(unit);
    if (!update) continue;

    try {
      await updateGrocyEntity('quantity_units', unitIdNum, update);
      normalizedGrocy++;

      await db.update(unitMappings)
        .set({ grocyUnitName: update.name ?? unit.name })
        .where(eq(unitMappings.grocyUnitId, unitIdNum));
    } catch (e) {
      log.error(`Failed to normalize Grocy unit ${unit.id}:`, e);
    }
  }

  return { normalizedMealie, normalizedGrocy, skippedDuplicates };
}

export async function normalizeProducts() {
  const [mealieFoods, grocyProducts] = await Promise.all([
    fetchAllMealieFoods(),
    getGrocyEntities('products'),
  ]);
  const existingMappings = await db.select().from(productMappings);
  const mappedGrocyProductIds = new Set(existingMappings.map(m => m.grocyProductId));

  // Build a set of all existing normalized names to detect conflicts.
  // Mealie enforces unique (name, group_id), so capitalizing "apple" → "Apple"
  // will fail if "Apple" already exists as a separate food.
  const existingNames = new Set(mealieFoods.map(f => f.name));

  let normalizedMealie = 0;
  let normalizedGrocy = 0;
  const skippedDuplicates: string[] = [];

  for (const food of mealieFoods) {
    const update = buildNormalizedMealieFoodUpdate(food);
    if (!update) continue;

    // Skip if another food already has the normalized name (duplicate in Mealie)
    if (existingNames.has(update.name) && update.name !== food.name) {
      skippedDuplicates.push(`"${food.name}" → "${update.name}"`);
      continue;
    }

    try {
      await RecipesFoodsService.updateOneApiFoodsItemIdPut(food.id, update);
      // Update the set so subsequent items see the new name
      existingNames.delete(food.name);
      existingNames.add(update.name);
      normalizedMealie++;

      const mapping = existingMappings.find(m => m.mealieFoodId === food.id);
      if (mapping) {
        await db.update(productMappings)
          .set({ mealieFoodName: update.name })
          .where(eq(productMappings.mealieFoodId, food.id));
      }
    } catch (e: any) {
      log.error(`Failed to normalize Mealie product ${food.id}:`, e?.body ?? e);
    }
  }

  if (skippedDuplicates.length > 0) {
    log.info(`[Normalize] Skipped ${skippedDuplicates.length} Mealie products due to name conflicts: ${skippedDuplicates.join(', ')}`);
  }

  for (const product of grocyProducts) {
    if (!product.id || !product.name) continue;
    const productIdNum = Number(product.id);
    if (!mappedGrocyProductIds.has(productIdNum)) continue;

    const update = buildNormalizedGrocyProductUpdate(product);
    if (!update) continue;

    try {
      await updateGrocyEntity('products', productIdNum, update);
      normalizedGrocy++;

      await db.update(productMappings)
        .set({ grocyProductName: update.name ?? product.name })
        .where(eq(productMappings.grocyProductId, productIdNum));
    } catch (e) {
      log.error(`Failed to normalize Grocy product ${product.id}:`, e);
    }
  }

  return { normalizedMealie, normalizedGrocy, skippedDuplicates };
}
