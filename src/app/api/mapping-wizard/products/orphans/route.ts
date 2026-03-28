import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';
import { getGrocyEntities, deleteGrocyEntity } from '@/lib/grocy/types';
import type { Product } from '@/lib/grocy/types';
import { RecipesFoodsService } from '@/lib/mealie';
import { extractFoods } from '@/lib/mealie/types';
import type { MealieFood } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { orphanDeleteRequestSchema } from '@/lib/validation';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

/** GET: List orphan products (Grocy products with no Mealie counterpart) */
export async function GET() {
  try {
    const [grocyProducts, mealieFoodsRes, existingMappings] = await Promise.all([
      getGrocyEntities('products'),
      RecipesFoodsService.getAllApiFoodsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
      ),
      db.select().from(productMappings),
    ]);

    const mealieFoods = extractFoods(mealieFoodsRes);
    const mealieFoodNames = new Set(mealieFoods.map(f => (f.name || '').toLowerCase()));
    const mappedGrocyProductIds = new Set(existingMappings.map(m => m.grocyProductId));

    const orphans = grocyProducts.filter(p => {
      const id = Number(p.id);
      const name = (p.name || '').toLowerCase();
      return !mappedGrocyProductIds.has(id) && !mealieFoodNames.has(name);
    });

    return NextResponse.json({
      orphans: orphans.map(p => ({ id: String(p.id), name: p.name })),
      total: orphans.length,
      grocyTotal: grocyProducts.length,
    });
  } catch (error) {
    log.error('[MappingWizard] Orphan product listing failed:', error);
    return NextResponse.json({ error: 'Failed to list orphan products' }, { status: 500 });
  }
}

/** POST: Delete specified orphan products with confirmation */
export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  const history = createManualHistoryRecorder(
    'mapping_product_delete_orphans',
    '[History] Failed to record orphan product deletion:',
  );
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = orphanDeleteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { confirm: true, ids: string[] }', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { ids } = parsed.data;

    // Circuit breaker: verify upstream APIs are responding
    let grocyProducts: Product[];
    let mealieFoods: MealieFood[];
    let existingMappings: { grocyProductId: number }[];
    try {
      const [grocyProductsResult, mealieFoodsRes, mappings] = await Promise.all([
        getGrocyEntities('products'),
        RecipesFoodsService.getAllApiFoodsGet(
          undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
        ),
        db.select().from(productMappings),
      ]);
      grocyProducts = grocyProductsResult;
      mealieFoods = extractFoods(mealieFoodsRes);
      existingMappings = mappings;
    } catch (upstreamError) {
      log.error('[MappingWizard] Upstream API unavailable during orphan deletion:', upstreamError);
      return NextResponse.json(
        { error: 'Upstream API unavailable. Refusing to delete to prevent data loss.' },
        { status: 503 },
      );
    }

    // Circuit breaker: if Mealie returns empty, refuse to delete
    if (mealieFoods.length === 0) {
      log.warn('[MappingWizard] Mealie returned 0 foods — refusing orphan product deletion');
      return NextResponse.json(
        { error: 'Upstream API unavailable. Mealie returned no foods — refusing to delete to prevent data loss.' },
        { status: 503 },
      );
    }

    // Circuit breaker: if > 50% of Grocy items would be deleted, refuse
    if (grocyProducts.length > 0 && ids.length > grocyProducts.length * 0.5) {
      log.warn(
        `[MappingWizard] Refusing orphan product deletion: ${ids.length} of ${grocyProducts.length} Grocy products would be deleted (>50%)`,
      );
      return NextResponse.json(
        {
          error: `Refusing to delete ${ids.length} of ${grocyProducts.length} Grocy products (>50%). This may indicate an upstream API issue. Please review manually.`,
        },
        { status: 400 },
      );
    }

    // Compute actual orphan IDs (same logic as GET handler) to prevent
    // arbitrary deletion of mapped/active products via forged IDs.
    const mappedGrocyProductIds = new Set(existingMappings.map(m => m.grocyProductId));
    const mealieFoodNames = new Set(mealieFoods.map(f => (f.name || '').toLowerCase()));
    const orphanIds = new Set(
      grocyProducts
        .filter(p => !mappedGrocyProductIds.has(Number(p.id)) && !mealieFoodNames.has((p.name || '').toLowerCase()))
        .map(p => String(p.id)),
    );
    const validIds = ids.filter(id => orphanIds.has(id));

    if (validIds.length < ids.length) {
      log.warn(`[MappingWizard] Filtered ${ids.length - validIds.length} non-orphan IDs from deletion request`);
    }

    let deleted = 0;
    for (const id of validIds) {
      try {
        await deleteGrocyEntity('products', Number(id));
        deleted++;
      } catch (e) {
        log.error(`[MappingWizard] Failed to delete Grocy product ${id}:`, e);
      }
    }

    log.info(`[MappingWizard] Orphan products deleted: ${deleted}/${validIds.length}`);
    await history.record({
      status: 'success',
      message: `Deleted ${deleted} orphan Grocy product(s) out of ${validIds.length} requested orphan(s).`,
      summary: {
        requested: ids.length,
        valid: validIds.length,
        deleted,
      },
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'orphans',
          message: `Deleted ${deleted} orphan Grocy product(s).`,
          details: { requested: ids.length, valid: validIds.length, deleted },
        }),
      ],
    });
    return NextResponse.json({ deleted, total: validIds.length });
  } catch (error) {
    log.error('[MappingWizard] Orphan product deletion failed:', error);
    await history.record({
      status: 'failure',
      message: `Orphan product deletion failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'orphans',
          message: 'Orphan product deletion failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Orphan product deletion failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
