import { db } from '../db';
import { productMappings, unitMappings } from '../db/schema';
import { GenericEntityInteractionsService } from '../grocy/client';
import { RecipesFoodsService, RecipesUnitsService } from '../mealie/client';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function syncUnits() {
  console.log('[ProductSync] Starting unit sync');

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

  console.log(`[ProductSync] Units done: ${created} created, ${linked} linked`);
}

export async function syncProducts() {
  console.log('[ProductSync] Starting product sync');

  const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
    undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000
  );
  const mealieFoods = (mealieFoodsRes as any).items || [];

  const grocyProducts = await GenericEntityInteractionsService.getObjects('products' as any) as any[];

  let created = 0;
  let linked = 0;

  for (const mFood of mealieFoods) {
    if (!mFood.id) continue;

    const existing = await db.select().from(productMappings).where(eq(productMappings.mealieFoodId, mFood.id)).limit(1);
    if (existing.length > 0) continue;

    // B1.4: Match by name (case-insensitive)
    let gProd = grocyProducts.find((gp: any) => gp.name?.toLowerCase() === mFood.name?.toLowerCase());

    if (!gProd) {
      // Get the first unit to use as default for QU fields
      const firstUnit = await db.select().from(unitMappings).limit(1);
      const defaultQuId = firstUnit.length > 0 ? firstUnit[0].grocyUnitId : 1;

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
        console.error(`[ProductSync] Failed to create Grocy product for "${mFood.name}":`, e);
        continue;
      }
    } else {
      linked++;
    }

    await db.insert(productMappings).values({
      id: randomUUID(),
      mealieFoodId: mFood.id,
      mealieFoodName: mFood.name || 'Unknown',
      grocyProductId: Number(gProd.id),
      grocyProductName: gProd.name,
      unitMappingId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log(`[ProductSync] Products done: ${created} created, ${linked} linked`);
}

export async function runFullProductSync() {
  await syncUnits();
  await syncProducts();
  console.log('[ProductSync] Full sync complete');
}
