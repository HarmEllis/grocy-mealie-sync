import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, deleteGrocyEntity } from '@/lib/grocy/types';
import type { QuantityUnit } from '@/lib/grocy/types';
import { RecipesUnitsService } from '@/lib/mealie';
import { extractUnits } from '@/lib/mealie/types';
import type { MealieUnit } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { orphanDeleteRequestSchema } from '@/lib/validation';

/** GET: List orphan units (Grocy units with no Mealie counterpart) */
export async function GET() {
  try {
    const [grocyUnits, mealieUnitsRes, existingMappings] = await Promise.all([
      getGrocyEntities('quantity_units'),
      RecipesUnitsService.getAllApiUnitsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
      ),
      db.select().from(unitMappings),
    ]);

    const mealieUnits = extractUnits(mealieUnitsRes);
    const mealieUnitNames = new Set(mealieUnits.flatMap(u => [
      (u.name || '').toLowerCase(),
      (u.abbreviation || '').toLowerCase(),
    ].filter(Boolean)));
    const mappedGrocyUnitIds = new Set(existingMappings.map(m => m.grocyUnitId));

    const orphans = grocyUnits.filter(u => {
      const id = Number(u.id);
      const name = (u.name || '').toLowerCase();
      return !mappedGrocyUnitIds.has(id) && !mealieUnitNames.has(name);
    });

    return NextResponse.json({
      orphans: orphans.map(u => ({ id: String(u.id), name: u.name })),
      total: orphans.length,
      grocyTotal: grocyUnits.length,
    });
  } catch (error) {
    log.error('[MappingWizard] Orphan unit listing failed:', error);
    return NextResponse.json({ error: 'Failed to list orphan units' }, { status: 500 });
  }
}

/** POST: Delete specified orphan units with confirmation */
export async function POST(request: Request) {
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
    let grocyUnits: QuantityUnit[];
    let mealieUnits: MealieUnit[];
    try {
      const [grocyUnitsResult, mealieUnitsRes] = await Promise.all([
        getGrocyEntities('quantity_units'),
        RecipesUnitsService.getAllApiUnitsGet(
          undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
        ),
      ]);
      grocyUnits = grocyUnitsResult;
      mealieUnits = extractUnits(mealieUnitsRes);
    } catch (upstreamError) {
      log.error('[MappingWizard] Upstream API unavailable during orphan deletion:', upstreamError);
      return NextResponse.json(
        { error: 'Upstream API unavailable. Refusing to delete to prevent data loss.' },
        { status: 503 },
      );
    }

    // Circuit breaker: if Mealie returns empty, refuse to delete
    if (mealieUnits.length === 0) {
      log.warn('[MappingWizard] Mealie returned 0 units — refusing orphan unit deletion');
      return NextResponse.json(
        { error: 'Upstream API unavailable. Mealie returned no units — refusing to delete to prevent data loss.' },
        { status: 503 },
      );
    }

    // Circuit breaker: if > 50% of Grocy items would be deleted, refuse
    if (grocyUnits.length > 0 && ids.length > grocyUnits.length * 0.5) {
      log.warn(
        `[MappingWizard] Refusing orphan unit deletion: ${ids.length} of ${grocyUnits.length} Grocy units would be deleted (>50%)`,
      );
      return NextResponse.json(
        {
          error: `Refusing to delete ${ids.length} of ${grocyUnits.length} Grocy units (>50%). This may indicate an upstream API issue. Please review manually.`,
        },
        { status: 400 },
      );
    }

    // Only delete the specifically requested IDs
    const idsToDelete = new Set(ids);
    let deleted = 0;
    for (const id of idsToDelete) {
      try {
        await deleteGrocyEntity('quantity_units', Number(id));
        deleted++;
      } catch (e) {
        log.error(`[MappingWizard] Failed to delete Grocy unit ${id}:`, e);
      }
    }

    log.info(`[MappingWizard] Orphan units deleted: ${deleted}/${idsToDelete.size}`);
    return NextResponse.json({ deleted, total: idsToDelete.size });
  } catch (error) {
    log.error('[MappingWizard] Orphan unit deletion failed:', error);
    return NextResponse.json({ error: 'Orphan unit deletion failed' }, { status: 500 });
  }
}
