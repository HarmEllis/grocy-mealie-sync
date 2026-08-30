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
import { defaultSyncLockDeps, runWithSyncLock } from '@/lib/use-cases/shared/sync-lock';
import { mappingWizardErrorResponse } from '../../helpers';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

export async function POST(request: Request) {
  try {
    // Poll for the lock instead of failing instantly: a chunked bulk run sends
    // many sequential requests, and one arriving mid-scheduler-cycle should
    // wait rather than abort the whole run.
    return await runWithSyncLock(defaultSyncLockDeps, () => createProducts(request), { maxWaitMs: 10_000 });
  } catch (error) {
    return mappingWizardErrorResponse(error);
  }
}

async function createProducts(request: Request) {
  const history = createManualHistoryRecorder(
    'mapping_product_create',
    '[History] Failed to record product creation:',
  );

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
    const mealieFoodsById = new Map(extractFoods(mealieFoodsRes).map(food => [food.id, food]));

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

    const unitMappingByGrocyUnitId = new Map(allUnitMappings.map(mapping => [mapping.grocyUnitId, mapping]));

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const items: Array<{ id: string; status: 'created' | 'skipped' | 'failed'; error?: string }> = [];

    for (const mealieFoodId of mealieFoodIds) {
      if (mappedMealieFoodIds.has(mealieFoodId)) {
        skipped++;
        items.push({ id: mealieFoodId, status: 'skipped' });
        continue;
      }

      const mFood = mealieFoodsById.get(mealieFoodId);
      if (!mFood) {
        skipped++;
        items.push({ id: mealieFoodId, status: 'skipped', error: 'Mealie food no longer exists' });
        continue;
      }

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

        const perUnitMapping = unitMappingByGrocyUnitId.get(grocyUnitId);

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

        // Claim the id inside this request too, so a duplicate id in one
        // payload cannot create the same product twice.
        mappedMealieFoodIds.add(mealieFoodId);
        created++;
        items.push({ id: mealieFoodId, status: 'created' });
      } catch (e) {
        failed++;
        items.push({ id: mealieFoodId, status: 'failed', error: e instanceof Error ? e.message : String(e) });
        log.error(`[MappingWizard] Failed to create Grocy product "${name}":`, e);
      }
    }

    const status = failed > 0 ? 'partial' : 'success';

    await history.recordOutcome({
      status,
      logLevel: 'info',
      logMessage: `[MappingWizard] Products created: ${created}, skipped: ${skipped}, failed: ${failed}`,
      message: failed > 0
        ? `Created ${created} Grocy product mapping(s); skipped ${skipped}; failed ${failed}.`
        : `Created ${created} Grocy product mapping(s); skipped ${skipped}.`,
      summary: {
        requested: mealieFoodIds.length,
        created,
        skipped,
        failed,
      },
      events: [
        buildManualHistoryEvent({
          level: failed > 0 ? 'warning' : 'info',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: failed > 0
            ? `Created ${created} Grocy product(s) from Mealie foods; ${failed} failed.`
            : `Created ${created} Grocy product(s) from Mealie foods.`,
          details: { requested: mealieFoodIds.length, created, skipped, failed },
        }),
      ],
    });
    return NextResponse.json({ created, skipped, failed, items });
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Product creation failed:',
      error,
      message: `Grocy product creation failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: 'Grocy product creation failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Product creation failed' }, { status: 500 });
  }
}
