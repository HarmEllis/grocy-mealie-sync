import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, createGrocyEntity } from '@/lib/grocy/types';
import { RecipesFoodsService } from '@/lib/mealie';
import { extractFoods } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { productCreateRequestSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = productCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { mealieFoodIds, defaultGrocyUnitId, unitOverrides } = parsed.data;

    if (mealieFoodIds.length === 0) {
      return NextResponse.json({ error: 'mealieFoodIds array must not be empty' }, { status: 400 });
    }

    const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
      undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
    );
    const mealieFoods = extractFoods(mealieFoodsRes);

    // Find unit mapping for the default unit
    const allUnitMappings = await db.select().from(unitMappings);
    const unitMapping = allUnitMappings.find(u => u.grocyUnitId === defaultGrocyUnitId);
    const unitMappingId = unitMapping?.id || null;

    // Fetch first available Grocy location (avoids hardcoded location_id: 1)
    let locationId: number | null = null;
    try {
      const locations = await getGrocyEntities('locations');
      if (locations.length === 0) {
        log.error('[MappingWizard] No locations found in Grocy — cannot create products without a location');
        return NextResponse.json({ error: 'No Grocy locations available' }, { status: 500 });
      }
      locationId = Number(locations[0].id);
    } catch (e) {
      log.error('[MappingWizard] Failed to fetch Grocy locations:', e);
      return NextResponse.json({ error: 'Failed to fetch Grocy locations' }, { status: 500 });
    }

    // Pre-fetch existing product mappings to avoid N+1 queries
    const existingMappings = await db.select().from(productMappings);
    const mappedMealieFoodIds = new Set(existingMappings.map(m => m.mealieFoodId));

    let created = 0;
    let skipped = 0;

    for (const mealieFoodId of mealieFoodIds) {
      if (mappedMealieFoodIds.has(mealieFoodId)) {
        skipped++;
        continue;
      }

      const mFood = mealieFoods.find(f => f.id === mealieFoodId);
      if (!mFood) continue;

      const name = mFood.name || 'Unknown';
      const grocyUnitId = unitOverrides?.[mealieFoodId] ?? defaultGrocyUnitId;

      try {
        const result = await createGrocyEntity('products', {
          name,
          min_stock_amount: 0,
          qu_id_purchase: grocyUnitId,
          qu_id_stock: grocyUnitId,
          location_id: locationId,
        });

        const perUnitMapping = allUnitMappings.find(u => u.grocyUnitId === grocyUnitId);

        await db.insert(productMappings).values({
          id: randomUUID(),
          mealieFoodId,
          mealieFoodName: name,
          grocyProductId: Number(result.created_object_id),
          grocyProductName: name,
          unitMappingId: perUnitMapping?.id || unitMappingId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        created++;
      } catch (e) {
        log.error(`[MappingWizard] Failed to create Grocy product "${name}":`, e);
      }
    }

    log.info(`[MappingWizard] Products created: ${created}, skipped: ${skipped}`);
    return NextResponse.json({ created, skipped });
  } catch (error) {
    log.error('[MappingWizard] Product creation failed:', error);
    return NextResponse.json({ error: 'Product creation failed' }, { status: 500 });
  }
}
