import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, updateGrocyEntity } from '@/lib/grocy/types';
import { RecipesFoodsService } from '@/lib/mealie';
import { extractFoods } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { productSyncRequestSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = productSyncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { mappings } = parsed.data;

    if (mappings.length === 0) {
      return NextResponse.json({ error: 'mappings array must not be empty' }, { status: 400 });
    }

    // Fetch Mealie foods and Grocy products for name resolution
    const [mealieFoodsRes, grocyProducts, allUnitMappings] = await Promise.all([
      RecipesFoodsService.getAllApiFoodsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
      ),
      getGrocyEntities('products'),
      db.select().from(unitMappings),
    ]);
    const mealieFoods = extractFoods(mealieFoodsRes);

    // Pre-fetch existing product mappings to avoid N+1 queries
    const existingMappings = await db.select().from(productMappings);
    const existingByMealieFoodId = new Map(existingMappings.map(m => [m.mealieFoodId, m]));

    let synced = 0;
    let renamed = 0;

    for (const entry of mappings) {
      const mFood = mealieFoods.find(f => f.id === entry.mealieFoodId);
      const gProd = grocyProducts.find(p => Number(p.id) === entry.grocyProductId);
      if (!mFood || !gProd) continue;

      const mealieName = mFood.name || 'Unknown';
      const grocyName = gProd.name || 'Unknown';

      // Find or resolve unit mapping
      let unitMappingId: string | null = null;
      if (entry.grocyUnitId) {
        const um = allUnitMappings.find(u => u.grocyUnitId === entry.grocyUnitId);
        if (um) unitMappingId = um.id;
      }

      // Upsert: insert or update on conflict
      const now = new Date();
      await db.insert(productMappings).values({
        id: randomUUID(),
        mealieFoodId: entry.mealieFoodId,
        mealieFoodName: mealieName,
        grocyProductId: entry.grocyProductId,
        grocyProductName: grocyName,
        unitMappingId,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: productMappings.mealieFoodId,
        set: {
          grocyProductId: entry.grocyProductId,
          grocyProductName: grocyName,
          unitMappingId,
          updatedAt: now,
        },
      });
      synced++;

      // Rename Grocy product to Mealie name
      if (gProd.name !== mealieName) {
        try {
          await updateGrocyEntity('products', entry.grocyProductId, { name: mealieName });
          renamed++;
        } catch (e) {
          log.error(`[MappingWizard] Failed to rename Grocy product ${entry.grocyProductId}:`, e);
        }
      }
    }

    log.info(`[MappingWizard] Products synced: ${synced}, renamed: ${renamed}`);
    return NextResponse.json({ synced, renamed });
  } catch (error) {
    log.error('[MappingWizard] Product sync failed:', error);
    return NextResponse.json({ error: 'Product sync failed' }, { status: 500 });
  }
}
