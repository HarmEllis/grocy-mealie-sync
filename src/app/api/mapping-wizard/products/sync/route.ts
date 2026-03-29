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
import {
  findDuplicateGrocyProductAssignment,
  findProductMappingConflict,
  formatProductMappingConflictMessage,
} from '@/lib/mapping-conflicts';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  const history = createManualHistoryRecorder(
    'mapping_product_sync',
    '[History] Failed to record product mapping sync:',
  );
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
    const [mealieFoodsRes, grocyProducts, allUnitMappings, existingMappings] = await Promise.all([
      RecipesFoodsService.getAllApiFoodsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 10000,
      ),
      getGrocyEntities('products'),
      db.select().from(unitMappings),
      db.select().from(productMappings),
    ]);
    const mealieFoods = extractFoods(mealieFoodsRes);

    const duplicateAssignment = findDuplicateGrocyProductAssignment(mappings);
    if (duplicateAssignment) {
      return NextResponse.json(
        {
          error: `Grocy product #${duplicateAssignment.grocyProductId} is selected for multiple Mealie foods in the same request.`,
          conflict: duplicateAssignment,
        },
        { status: 409 },
      );
    }

    for (const entry of mappings) {
      const conflict = findProductMappingConflict(existingMappings, entry.mealieFoodId, entry.grocyProductId);
      if (conflict) {
        return NextResponse.json(
          {
            error: formatProductMappingConflictMessage(conflict, entry.grocyProductId),
            conflict: {
              grocyProductId: entry.grocyProductId,
              mealieFoodId: conflict.mealieFoodId,
            },
          },
          { status: 409 },
        );
      }
    }

    let synced = 0;
    let renamed = 0;
    let renameFailed = 0;

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
          renameFailed++;
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

    const status = renameFailed > 0 ? 'partial' : 'success';

    await history.recordOutcome({
      status,
      logLevel: 'info',
      logMessage: `[MappingWizard] Products synced: ${synced}, renamed: ${renamed}, rename failures: ${renameFailed}`,
      message: renameFailed > 0
        ? `Mapped ${synced} product(s); renamed ${renamed}; ${renameFailed} rename(s) failed.`
        : `Mapped ${synced} product(s); renamed ${renamed}.`,
      summary: {
        requested: mappings.length,
        synced,
        renamed,
        renameFailed,
      },
      events: [
        buildManualHistoryEvent({
          level: renameFailed > 0 ? 'warning' : 'info',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: renameFailed > 0
            ? `Mapped ${synced} product(s); ${renameFailed} rename(s) failed.`
            : `Mapped ${synced} product(s).`,
          details: { requested: mappings.length, synced, renamed, renameFailed },
        }),
      ],
    });
    return NextResponse.json({ synced, renamed });
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Product sync failed:',
      error,
      message: `Product mapping sync failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: 'Product mapping sync failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Product sync failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
