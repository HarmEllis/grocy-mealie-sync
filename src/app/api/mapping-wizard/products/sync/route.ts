import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesFoodsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface MappingEntry {
  mealieFoodId: string;
  grocyProductId: number;
  grocyUnitId: number;
}

export async function POST(request: Request) {
  try {
    const { mappings } = (await request.json()) as { mappings: MappingEntry[] };

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json({ error: 'mappings array is required' }, { status: 400 });
    }

    // Fetch Mealie foods and Grocy products for name resolution
    const [mealieFoodsRes, grocyProductsRaw, allUnitMappings] = await Promise.all([
      RecipesFoodsService.getAllApiFoodsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
      ),
      GenericEntityInteractionsService.getObjects('products' as any),
      db.select().from(unitMappings),
    ]);
    const mealieFoods: any[] = (mealieFoodsRes as any).items || [];
    const grocyProducts: any[] = Array.isArray(grocyProductsRaw) ? grocyProductsRaw : [];

    // Pre-fetch existing product mappings to avoid N+1 queries
    const existingMappings = await db.select().from(productMappings);
    const existingByMealieFoodId = new Map(existingMappings.map(m => [m.mealieFoodId, m]));

    let synced = 0;
    let renamed = 0;

    for (const entry of mappings) {
      const mFood = mealieFoods.find((f: any) => f.id === entry.mealieFoodId);
      const gProd = grocyProducts.find((p: any) => Number(p.id) === entry.grocyProductId);
      if (!mFood || !gProd) continue;

      const mealieName = mFood.name || 'Unknown';
      const grocyName = gProd.name || 'Unknown';

      // Find or resolve unit mapping
      let unitMappingId = '';
      if (entry.grocyUnitId) {
        const um = allUnitMappings.find(u => u.grocyUnitId === entry.grocyUnitId);
        if (um) unitMappingId = um.id;
      }

      // Check if mapping already exists (update) or create new
      const existing = existingByMealieFoodId.get(entry.mealieFoodId);

      if (existing) {
        await db.update(productMappings).set({
          grocyProductId: entry.grocyProductId,
          grocyProductName: grocyName,
          unitMappingId,
          updatedAt: new Date(),
        }).where(eq(productMappings.mealieFoodId, entry.mealieFoodId));
      } else {
        await db.insert(productMappings).values({
          id: randomUUID(),
          mealieFoodId: entry.mealieFoodId,
          mealieFoodName: mealieName,
          grocyProductId: entry.grocyProductId,
          grocyProductName: grocyName,
          unitMappingId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      synced++;

      // Rename Grocy product to Mealie name
      if (gProd.name !== mealieName) {
        try {
          await GenericEntityInteractionsService.putObjects(
            'products' as any,
            entry.grocyProductId,
            { name: mealieName } as any,
          );
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
