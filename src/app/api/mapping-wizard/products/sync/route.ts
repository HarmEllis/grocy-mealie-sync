import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings, unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, updateGrocyEntity } from '@/lib/grocy/types';
import { RecipesFoodsService } from '@/lib/mealie';
import { extractFoods } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { productSyncRequestSchema } from '@/lib/validation';
import { defaultSyncLockDeps, runWithSyncLock } from '@/lib/use-cases/shared/sync-lock';
import { mappingWizardErrorResponse } from '../../helpers';
import {
  findProductMappingConflict,
  formatProductMappingConflictMessage,
} from '@/lib/mapping-conflicts';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

export async function POST(request: Request) {
  try {
    // Poll for the lock rather than failing instantly: a chunked bulk run
    // sends many sequential requests and one arriving mid-scheduler-cycle
    // should wait instead of aborting the whole run.
    return await runWithSyncLock(defaultSyncLockDeps, () => syncProducts(request), { maxWaitMs: 10_000 });
  } catch (error) {
    return mappingWizardErrorResponse(error);
  }
}

async function syncProducts(request: Request) {

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

    // Conflicting entries are skipped and reported rather than failing the
    // whole request. A bulk run is chunked, so rejecting the batch would
    // discard up to 499 good mappings because of one stale duplicate — and
    // halt the run partway down the list.
    const conflicts: Array<{ mealieFoodId: string; grocyProductId: number; reason: string }> = [];
    const skippedFoodIds = new Set<string>();

    // Every duplicate group has to be collected before any write. The shared
    // findDuplicateGrocyProductAssignment() helper returns only the FIRST
    // group, which was fine while a duplicate aborted the whole request — but
    // under skip-and-report a second group would sail through and hit the
    // unique grocy_product_id index mid-loop, i.e. a 500 after partial writes.
    const foodIdsByGrocyProductId = new Map<number, Set<string>>();
    const entriesByMealieFoodId = new Map<string, number>();

    for (const entry of mappings) {
      const claimants = foodIdsByGrocyProductId.get(entry.grocyProductId) ?? new Set<string>();
      claimants.add(entry.mealieFoodId);
      foodIdsByGrocyProductId.set(entry.grocyProductId, claimants);
      entriesByMealieFoodId.set(entry.mealieFoodId, (entriesByMealieFoodId.get(entry.mealieFoodId) ?? 0) + 1);
    }

    for (const entry of mappings) {
      const claimants = foodIdsByGrocyProductId.get(entry.grocyProductId);
      if (claimants && claimants.size > 1) {
        skippedFoodIds.add(entry.mealieFoodId);
        conflicts.push({
          mealieFoodId: entry.mealieFoodId,
          grocyProductId: entry.grocyProductId,
          reason: `Grocy product #${entry.grocyProductId} is selected for multiple Mealie foods in the same request.`,
        });
        continue;
      }

      // The same Mealie food listed twice would likewise violate the unique
      // mealie_food_id index on the second insert.
      if ((entriesByMealieFoodId.get(entry.mealieFoodId) ?? 0) > 1) {
        skippedFoodIds.add(entry.mealieFoodId);
        conflicts.push({
          mealieFoodId: entry.mealieFoodId,
          grocyProductId: entry.grocyProductId,
          reason: `Mealie food ${entry.mealieFoodId} appears more than once in the same request.`,
        });
      }
    }

    for (const entry of mappings) {
      if (skippedFoodIds.has(entry.mealieFoodId)) {
        continue;
      }
      const conflict = findProductMappingConflict(existingMappings, entry.mealieFoodId, entry.grocyProductId);
      if (conflict) {
        skippedFoodIds.add(entry.mealieFoodId);
        conflicts.push({
          mealieFoodId: entry.mealieFoodId,
          grocyProductId: entry.grocyProductId,
          reason: formatProductMappingConflictMessage(conflict, entry.grocyProductId),
        });
      }
    }

    let synced = 0;
    let renamed = 0;
    let renameFailed = 0;
    const skipped = skippedFoodIds.size;

    const mealieFoodsById = new Map(mealieFoods.map(food => [food.id, food]));
    const grocyProductsById = new Map(grocyProducts.map(product => [Number(product.id), product]));

    for (const entry of mappings) {
      if (skippedFoodIds.has(entry.mealieFoodId)) {
        continue;
      }
      const mFood = mealieFoodsById.get(entry.mealieFoodId);
      const gProd = grocyProductsById.get(entry.grocyProductId);
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

    const status = renameFailed > 0 || conflicts.length > 0 ? 'partial' : 'success';

    await history.recordOutcome({
      status,
      logLevel: 'info',
      logMessage: `[MappingWizard] Products synced: ${synced}, renamed: ${renamed}, rename failures: ${renameFailed}, skipped: ${skipped}`,
      message: [
        `Mapped ${synced} product(s); renamed ${renamed}`,
        renameFailed > 0 ? `; ${renameFailed} rename(s) failed` : '',
        skipped > 0 ? `; ${skipped} skipped due to conflicts` : '',
        '.',
      ].join(''),
      summary: {
        requested: mappings.length,
        synced,
        renamed,
        renameFailed,
        skipped,
      },
      events: [
        buildManualHistoryEvent({
          level: renameFailed > 0 || conflicts.length > 0 ? 'warning' : 'info',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: renameFailed > 0
            ? `Mapped ${synced} product(s); ${renameFailed} rename(s) failed.`
            : `Mapped ${synced} product(s).`,
          details: { requested: mappings.length, synced, renamed, renameFailed, skipped, conflicts },
        }),
      ],
    });
    return NextResponse.json({ synced, renamed, renameFailed, skipped, conflicts });
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
  }
}
