import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { GenericEntityInteractionsService } from '../grocy/client';
import { RecipesFoodsService, RecipesUnitsService } from '../mealie/client';
import { config } from '../config';
import { log } from '../logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function findUnitMappingByGrocyId(grocyUnitId: number): Promise<string> {
  const rows = await db.select()
    .from(unitMappings)
    .where(eq(unitMappings.grocyUnitId, grocyUnitId))
    .limit(1);
  return rows.length > 0 ? rows[0].id : '';
}

let defaultUnitWarningLogged = false;

function resolveDefaultGrocyUnitId(allUnitMappings: { grocyUnitId: number }[]): number {
  if (config.grocyDefaultUnitId) return config.grocyDefaultUnitId;
  if (!defaultUnitWarningLogged) {
    if (allUnitMappings.length > 0) {
      log.warn('[ProductSync] GROCY_DEFAULT_UNIT_ID not set, falling back to first available unit');
    } else {
      log.warn('[ProductSync] GROCY_DEFAULT_UNIT_ID not set and no unit mappings exist, using unit ID 1');
    }
    defaultUnitWarningLogged = true;
  }
  return allUnitMappings.length > 0 ? allUnitMappings[0].grocyUnitId : 1;
}

export async function syncUnits() {
  log.info('[ProductSync] Starting unit sync');

  const mealieUnitsRes = await RecipesUnitsService.getAllApiUnitsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000
  );
  const mealieUnits = (mealieUnitsRes as any).items || [];

  const grocyUnits = await GenericEntityInteractionsService.getObjects('quantity_units' as any) as any[];

  let created = 0;
  let linked = 0;

  for (const mUnit of mealieUnits) {
    if (!mUnit.id) continue;

    const existing = await db.select().from(unitMappings).where(eq(unitMappings.mealieUnitId, mUnit.id)).limit(1);
    if (existing.length > 0) continue;

    // B1.4: Match by name or abbreviation
    let gUnit = grocyUnits.find((gu: any) =>
      gu.name?.toLowerCase() === mUnit.name?.toLowerCase() ||
      (mUnit.abbreviation && gu.name?.toLowerCase() === mUnit.abbreviation?.toLowerCase())
    );

    if (!gUnit) {
      const result = await GenericEntityInteractionsService.postObjects(
        'quantity_units' as any,
        { name: mUnit.name || 'Unknown', name_plural: mUnit.pluralName || mUnit.name } as any,
      );

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
      grocyUnitName: gUnit.name,
      conversionFactor: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  log.info(`[ProductSync] Units done: ${created} created, ${linked} linked`);
}

export async function syncProducts() {
  log.info('[ProductSync] Starting product sync');

  const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000
  );
  const mealieFoods = (mealieFoodsRes as any).items || [];

  const grocyProducts = await GenericEntityInteractionsService.getObjects('products' as any) as any[];
  const allUnitMappings = await db.select().from(unitMappings);

  let created = 0;
  let linked = 0;

  for (const mFood of mealieFoods) {
    if (!mFood.id) continue;

    const existing = await db.select().from(productMappings).where(eq(productMappings.mealieFoodId, mFood.id)).limit(1);
    if (existing.length > 0) continue;

    // B1.4: Match by name (case-insensitive)
    let gProd = grocyProducts.find((gp: any) => gp.name?.toLowerCase() === mFood.name?.toLowerCase());
    let unitMappingId = '';

    if (!gProd) {
      // New product: use configurable default unit
      const defaultQuId = resolveDefaultGrocyUnitId(allUnitMappings);
      unitMappingId = await findUnitMappingByGrocyId(defaultQuId);

      try {
        const result = await GenericEntityInteractionsService.postObjects(
          'products' as any,
          {
            name: mFood.name || 'Unknown',
            min_stock_amount: 0,
            qu_id_purchase: defaultQuId,
            qu_id_stock: defaultQuId,
            location_id: 1,
          } as any,
        );

        gProd = { id: result.created_object_id, name: mFood.name || 'Unknown' };
        grocyProducts.push(gProd);
        created++;
      } catch (e) {
        log.error(`[ProductSync] Failed to create Grocy product for "${mFood.name}":`, e);
        continue;
      }
    } else {
      // Linked product: read actual unit from Grocy
      const grocyUnitId = Number(gProd.qu_id_purchase || gProd.qu_id_stock);
      if (grocyUnitId) {
        unitMappingId = await findUnitMappingByGrocyId(grocyUnitId);
      }
      linked++;
    }

    await db.insert(productMappings).values({
      id: randomUUID(),
      mealieFoodId: mFood.id,
      mealieFoodName: mFood.name || 'Unknown',
      grocyProductId: Number(gProd.id),
      grocyProductName: gProd.name,
      unitMappingId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Backfill: update existing mappings that have empty unitMappingId
  const emptyMappings = await db.select().from(productMappings).where(eq(productMappings.unitMappingId, ''));
  if (emptyMappings.length > 0) {
    log.info(`[ProductSync] Backfilling ${emptyMappings.length} product mapping(s) with missing unit`);
    for (const mapping of emptyMappings) {
      const gProd = grocyProducts.find((gp: any) => Number(gp.id) === mapping.grocyProductId);
      if (gProd) {
        const grocyUnitId = Number(gProd.qu_id_purchase || gProd.qu_id_stock);
        if (grocyUnitId) {
          const umId = await findUnitMappingByGrocyId(grocyUnitId);
          if (umId) {
            await db.update(productMappings)
              .set({ unitMappingId: umId, updatedAt: new Date() })
              .where(eq(productMappings.id, mapping.id));
          }
        }
      }
    }
  }

  log.info(`[ProductSync] Products done: ${created} created, ${linked} linked`);
}

export async function runFullProductSync() {
  await syncUnits();
  await syncProducts();
  log.info('[ProductSync] Full sync complete');
}
