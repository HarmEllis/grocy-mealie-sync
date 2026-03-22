import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesFoodsService } from '@/lib/mealie';
import { log } from '@/lib/logger';

export async function DELETE() {
  try {
    const [grocyProductsRaw, mealieFoodsRes, existingMappings] = await Promise.all([
      GenericEntityInteractionsService.getObjects('products' as any),
      RecipesFoodsService.getAllApiFoodsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
      ),
      db.select().from(productMappings),
    ]);

    const grocyProducts: any[] = Array.isArray(grocyProductsRaw) ? grocyProductsRaw : [];
    const mealieFoods: any[] = (mealieFoodsRes as any).items || [];
    const mealieFoodNames = new Set(mealieFoods.map((f: any) => (f.name || '').toLowerCase()));
    const mappedGrocyProductIds = new Set(existingMappings.map(m => m.grocyProductId));

    // Orphans: Grocy products that are neither mapped nor have a Mealie counterpart by name
    const orphans = grocyProducts.filter((p: any) => {
      const id = Number(p.id);
      const name = (p.name || '').toLowerCase();
      return !mappedGrocyProductIds.has(id) && !mealieFoodNames.has(name);
    });

    let deleted = 0;
    for (const orphan of orphans) {
      try {
        await GenericEntityInteractionsService.deleteObjects('products' as any, Number(orphan.id));
        deleted++;
      } catch (e) {
        log.error(`[MappingWizard] Failed to delete Grocy product ${orphan.id} "${orphan.name}":`, e);
      }
    }

    log.info(`[MappingWizard] Orphan products deleted: ${deleted}/${orphans.length}`);
    return NextResponse.json({ deleted, total: orphans.length });
  } catch (error) {
    log.error('[MappingWizard] Orphan product deletion failed:', error);
    return NextResponse.json({ error: 'Orphan product deletion failed' }, { status: 500 });
  }
}
