import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, updateGrocyEntity } from '@/lib/grocy/types';
import { RecipesFoodsService } from '@/lib/mealie';
import { extractFoods } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { productSyncRequestSchema } from '@/lib/validation';
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

      // Rename Grocy product to Mealie name
      let effectiveGrocyName = grocyName;
      if (gProd.name !== mealieName) {
        try {
          await updateGrocyEntity('products', entry.grocyProductId, { name: mealieName });
          effectiveGrocyName = mealieName;
          renamed++;
        } catch (e) {
          log.error(`[MappingWizard] Failed to rename Grocy product ${entry.grocyProductId}:`, e);
        }
      }

      // Upsert: insert or update on conflict
      const now = new Date();
      await db.insert(productMappings).values({
        id: randomUUID(),
        mealieFoodId: entry.mealieFoodId,
        mealieFoodName: mealieName,
        grocyProductId: entry.grocyProductId,
        grocyProductName: effectiveGrocyName,
        unitMappingId,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: productMappings.mealieFoodId,
        set: {
          mealieFoodName: mealieName,
          grocyProductId: entry.grocyProductId,
          grocyProductName: effectiveGrocyName,
          unitMappingId,
          updatedAt: now,
        },
      });
      synced++;
    }

    log.info(`[MappingWizard] Products synced: ${synced}, renamed: ${renamed}`);
    return NextResponse.json({ synced, renamed });
  } catch (error) {
    log.error('[MappingWizard] Product sync failed:', error);
    return NextResponse.json({ error: 'Product sync failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
