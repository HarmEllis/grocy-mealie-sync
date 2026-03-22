import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { getGrocyEntities, createGrocyEntity } from '../grocy/types';
import type { Product, QuantityUnit } from '../grocy/types';
import { RecipesFoodsService, RecipesUnitsService } from '../mealie';
import { extractFoods, extractUnits } from '../mealie/types';
import { config } from '../config';
import { log } from '../logger';
import { getSettings } from '../settings';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Module-level cache for the first available Grocy location ID
let cachedLocationId: number | null | undefined = undefined;

async function getDefaultLocationId(): Promise<number | null> {
  if (cachedLocationId !== undefined) return cachedLocationId;
  try {
    const locations = await getGrocyEntities('locations');
    if (locations.length === 0) {
      log.error('[ProductSync] No locations found in Grocy — cannot create products without a location');
      cachedLocationId = null;
      return null;
    }
    cachedLocationId = Number(locations[0].id);
    return cachedLocationId;
  } catch (e) {
    log.error('[ProductSync] Failed to fetch Grocy locations:', e);
    cachedLocationId = null;
    return null;
  }
}

function findUnitMappingByGrocyId(
  allUnitMappings: { id: string; grocyUnitId: number }[],
  grocyUnitId: number,
): string | null {
  const match = allUnitMappings.find(u => u.grocyUnitId === grocyUnitId);
  return match ? match.id : null;
}

async function resolveDefaultUnit(allUnitMappings: { id: string; grocyUnitId: number }[]): Promise<{ grocyUnitId: number; unitMappingId: string | null } | null> {
  // Priority: 1. DB setting (from UI), 2. env var. Returns null if neither is configured.
  const settings = await getSettings();
  if (settings.defaultUnitMappingId) {
    const match = allUnitMappings.find(u => u.id === settings.defaultUnitMappingId);
    if (match) return { grocyUnitId: match.grocyUnitId, unitMappingId: match.id };
  }
  if (config.grocyDefaultUnitId) {
    const match = allUnitMappings.find(u => u.grocyUnitId === config.grocyDefaultUnitId);
    if (match) return { grocyUnitId: config.grocyDefaultUnitId, unitMappingId: match.id };
    return { grocyUnitId: config.grocyDefaultUnitId, unitMappingId: null };
  }
  return null;
}

export async function syncUnits() {
  log.info('[ProductSync] Starting unit sync');

  const settings = await getSettings();
  const mealieUnitsRes = await RecipesUnitsService.getAllApiUnitsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000
  );
  const mealieUnits = extractUnits(mealieUnitsRes);

  const grocyUnits: QuantityUnit[] = await getGrocyEntities('quantity_units');

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const mUnit of mealieUnits) {
    if (!mUnit.id) continue;

    const existing = await db.select().from(unitMappings).where(eq(unitMappings.mealieUnitId, mUnit.id)).limit(1);
    if (existing.length > 0) continue;

    // Match by name or abbreviation
    let gUnit = grocyUnits.find(gu =>
      gu.name?.toLowerCase() === mUnit.name?.toLowerCase() ||
      (mUnit.abbreviation && gu.name?.toLowerCase() === mUnit.abbreviation?.toLowerCase())
    );

    if (!gUnit) {
      if (!settings.autoCreateUnits) {
        skipped++;
        continue;
      }
      const result = await createGrocyEntity('quantity_units', {
        name: mUnit.name || 'Unknown',
        name_plural: mUnit.pluralName || mUnit.name || 'Unknown',
      });

      gUnit = { id: result.created_object_id, name: mUnit.name || 'Unknown' };
      grocyUnits.push(gUnit);
      created++;
    } else {
      linked++;
    }

    await db.insert(unitMappings).values({
      id: randomUUID(),
      mealieUnitId: mUnit.id,
      mealieUnitName: mUnit.name || 'Unknown',
      mealieUnitAbbreviation: mUnit.abbreviation || '',
      grocyUnitId: Number(gUnit.id),
      grocyUnitName: gUnit.name || 'Unknown',
      conversionFactor: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (skipped > 0) {
    log.info(`[ProductSync] ${skipped} unit(s) skipped — enable "Auto-create units" in settings or use the Mapping Wizard`);
  }
  log.info(`[ProductSync] Units done: ${created} created, ${linked} linked, ${skipped} skipped`);
}

export async function syncProducts() {
  log.info('[ProductSync] Starting product sync');

  const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000
  );
  const mealieFoods = extractFoods(mealieFoodsRes);

  const grocyProducts: Product[] = await getGrocyEntities('products');
  const allUnitMappings = await db.select().from(unitMappings);

  // Hoist settings fetch above the loop (task 7 — avoids N+1 DB calls)
  const settings = await getSettings();

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const mFood of mealieFoods) {
    if (!mFood.id) continue;

    const existing = await db.select().from(productMappings).where(eq(productMappings.mealieFoodId, mFood.id)).limit(1);
    if (existing.length > 0) continue;

    // B1.4: Match by name (case-insensitive)
    let gProd = grocyProducts.find(gp => gp.name?.toLowerCase() === mFood.name?.toLowerCase());
    let unitMappingId: string | null = null;

    if (!gProd) {
      if (!settings.autoCreateProducts) {
        skipped++;
        continue;
      }
      // New product: requires an explicitly configured default unit
      const defaultUnit = await resolveDefaultUnit(allUnitMappings);
      if (!defaultUnit) {
        skipped++;
        continue;
      }
      unitMappingId = defaultUnit.unitMappingId;

      // Fetch the first available location instead of hardcoding 1 (task 5)
      const locationId = await getDefaultLocationId();
      if (locationId === null) {
        log.error(`[ProductSync] Skipping product "${mFood.name}" — no Grocy location available`);
        skipped++;
        continue;
      }

      try {
        const result = await createGrocyEntity('products', {
          name: mFood.name || 'Unknown',
          min_stock_amount: 0,
          qu_id_purchase: defaultUnit.grocyUnitId,
          qu_id_stock: defaultUnit.grocyUnitId,
          location_id: locationId,
        });

        gProd = { id: result.created_object_id, name: mFood.name || 'Unknown' };
        grocyProducts.push(gProd);
        created++;
      } catch (e) {
        log.error(`[ProductSync] Failed to create Grocy product for "${mFood.name}":`, e);
        continue;
      }
    } else {
      // Linked product: read actual unit from Grocy (use in-memory lookup — task 9)
      const grocyUnitId = Number(gProd.qu_id_purchase || gProd.qu_id_stock);
      if (grocyUnitId) {
        unitMappingId = findUnitMappingByGrocyId(allUnitMappings, grocyUnitId);
      }
      linked++;
    }

    await db.insert(productMappings).values({
      id: randomUUID(),
      mealieFoodId: mFood.id,
      mealieFoodName: mFood.name || 'Unknown',
      grocyProductId: Number(gProd.id),
      grocyProductName: gProd.name || 'Unknown',
      unitMappingId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Backfill: update existing mappings that have empty unitMappingId
  const { isNull, or } = await import('drizzle-orm');
  const emptyMappings = await db.select().from(productMappings).where(
    or(isNull(productMappings.unitMappingId), eq(productMappings.unitMappingId, ''))
  );
  if (emptyMappings.length > 0) {
    log.info(`[ProductSync] Backfilling ${emptyMappings.length} product mapping(s) with missing unit`);
    for (const mapping of emptyMappings) {
      const gProd = grocyProducts.find(gp => Number(gp.id) === mapping.grocyProductId);
      if (gProd) {
        const grocyUnitId = Number(gProd.qu_id_purchase || gProd.qu_id_stock);
        if (grocyUnitId) {
          // Use in-memory lookup (task 9)
          const umId = findUnitMappingByGrocyId(allUnitMappings, grocyUnitId);
          if (umId) {
            await db.update(productMappings)
              .set({ unitMappingId: umId, updatedAt: new Date() })
              .where(eq(productMappings.id, mapping.id));
          }
        }
      }
    }
  }

  if (skipped > 0) {
    log.info(`[ProductSync] ${skipped} product(s) skipped — enable "Auto-create products" in settings or use the Mapping Wizard`);
  }
  log.info(`[ProductSync] Products done: ${created} created, ${linked} linked, ${skipped} skipped`);
}

export async function runFullProductSync() {
  await syncUnits();
  await syncProducts();
  log.info('[ProductSync] Full sync complete');
}
