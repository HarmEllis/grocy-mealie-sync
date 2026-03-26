import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities } from '@/lib/grocy/types';
import { log } from '@/lib/logger';
import { RecipesFoodsService } from '@/lib/mealie';
import { productCreateMealieRequestSchema } from '@/lib/validation';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';

export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = productCreateMealieRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { grocyProductIds, unitSelections } = parsed.data;
    if (grocyProductIds.length === 0) {
      return NextResponse.json({ error: 'grocyProductIds array must not be empty' }, { status: 400 });
    }

    const [grocyProducts, existingMappings, allUnitMappings] = await Promise.all([
      getGrocyEntities('products'),
      db.select().from(productMappings),
      db.select().from(unitMappings),
    ]);

    const mappedGrocyProductIds = new Set(existingMappings.map(mapping => mapping.grocyProductId));

    let created = 0;
    let skipped = 0;

    for (const grocyProductId of grocyProductIds) {
      if (mappedGrocyProductIds.has(grocyProductId)) {
        skipped++;
        continue;
      }

      const grocyProduct = grocyProducts.find(product => Number(product.id) === grocyProductId);
      if (!grocyProduct) {
        continue;
      }

      const grocyProductName = grocyProduct.name || 'Unknown';
      const unitSelectionKey = String(grocyProductId);
      const selectedGrocyUnitId = unitSelections && Object.prototype.hasOwnProperty.call(unitSelections, unitSelectionKey)
        ? unitSelections[unitSelectionKey]
        : Number(grocyProduct.qu_id_purchase || grocyProduct.qu_id_stock || 0);
      const grocyUnitId = Number(selectedGrocyUnitId || 0);
      const unitMappingId = grocyUnitId
        ? allUnitMappings.find(mapping => mapping.grocyUnitId === grocyUnitId)?.id ?? null
        : null;

      try {
        const createdFood = await RecipesFoodsService.createOneApiFoodsPost({
          name: grocyProductName,
        });

        await db.insert(productMappings).values({
          id: randomUUID(),
          mealieFoodId: createdFood.id,
          mealieFoodName: createdFood.name || grocyProductName,
          grocyProductId,
          grocyProductName,
          unitMappingId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        mappedGrocyProductIds.add(grocyProductId);
        created++;
      } catch (error) {
        log.error(`[MappingWizard] Failed to create Mealie product "${grocyProductName}":`, error);
      }
    }

    log.info(`[MappingWizard] Mealie products created from Grocy: ${created}, skipped: ${skipped}`);
    return NextResponse.json({ created, skipped });
  } catch (error) {
    log.error('[MappingWizard] Creating Mealie products from Grocy failed:', error);
    return NextResponse.json({ error: 'Creating Mealie products failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
