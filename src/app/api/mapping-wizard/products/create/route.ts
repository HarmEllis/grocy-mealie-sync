import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesFoodsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface CreateRequest {
  mealieFoodIds: string[];
  defaultGrocyUnitId: number;
  unitOverrides?: Record<string, number>;
}

export async function POST(request: Request) {
  try {
    const { mealieFoodIds, defaultGrocyUnitId, unitOverrides } = (await request.json()) as CreateRequest;

    if (!Array.isArray(mealieFoodIds) || mealieFoodIds.length === 0) {
      return NextResponse.json({ error: 'mealieFoodIds array is required' }, { status: 400 });
    }
    if (!defaultGrocyUnitId) {
      return NextResponse.json({ error: 'defaultGrocyUnitId is required' }, { status: 400 });
    }

    const mealieFoodsRes = await RecipesFoodsService.getAllApiFoodsGet(
      undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
    );
    const mealieFoods: any[] = (mealieFoodsRes as any).items || [];

    // Find unit mapping for the default unit
    const allUnitMappings = await db.select().from(unitMappings);
    const unitMapping = allUnitMappings.find(u => u.grocyUnitId === defaultGrocyUnitId);
    const unitMappingId = unitMapping?.id || '';

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

      const mFood = mealieFoods.find((f: any) => f.id === mealieFoodId);
      if (!mFood) continue;

      const name = mFood.name || 'Unknown';
      const grocyUnitId = unitOverrides?.[mealieFoodId] ?? defaultGrocyUnitId;

      try {
        const result = await GenericEntityInteractionsService.postObjects(
          'products' as any,
          {
            name,
            min_stock_amount: 0,
            qu_id_purchase: grocyUnitId,
            qu_id_stock: grocyUnitId,
            location_id: 1,
          } as any,
        );

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
