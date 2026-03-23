import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { getGrocyEntities, updateGrocyEntity } from '@/lib/grocy/types';
import { RecipesUnitsService } from '@/lib/mealie';
import { extractUnits } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { unitSyncRequestSchema } from '@/lib/validation';
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

    const parsed = unitSyncRequestSchema.safeParse(body);
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

    const [mealieUnitsRes, grocyUnits] = await Promise.all([
      RecipesUnitsService.getAllApiUnitsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
      ),
      getGrocyEntities('quantity_units'),
    ]);
    const mealieUnits = extractUnits(mealieUnitsRes);

    // Pre-fetch existing unit mappings to avoid N+1 queries
    const existingMappings = await db.select().from(unitMappings);
    const existingByMealieUnitId = new Map(existingMappings.map(m => [m.mealieUnitId, m]));

    let synced = 0;
    let renamed = 0;

    for (const entry of mappings) {
      const mUnit = mealieUnits.find(u => u.id === entry.mealieUnitId);
      const gUnit = grocyUnits.find(u => Number(u.id) === entry.grocyUnitId);
      if (!mUnit || !gUnit) continue;

      const mealieName = mUnit.name || 'Unknown';
      const grocyName = gUnit.name || 'Unknown';

      const now = new Date();
      await db.insert(unitMappings).values({
        id: randomUUID(),
        mealieUnitId: entry.mealieUnitId,
        mealieUnitName: mealieName,
        mealieUnitAbbreviation: mUnit.abbreviation || '',
        grocyUnitId: entry.grocyUnitId,
        grocyUnitName: grocyName,
        conversionFactor: 1,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: unitMappings.mealieUnitId,
        set: {
          grocyUnitId: entry.grocyUnitId,
          grocyUnitName: grocyName,
          updatedAt: now,
        },
      });
      synced++;

      // Rename Grocy unit to Mealie name
      if (gUnit.name !== mealieName) {
        try {
          await updateGrocyEntity('quantity_units', entry.grocyUnitId, {
            name: mealieName,
            name_plural: mUnit.pluralName || mealieName,
          });
          renamed++;
        } catch (e) {
          log.error(`[MappingWizard] Failed to rename Grocy unit ${entry.grocyUnitId}:`, e);
        }
      }
    }

    log.info(`[MappingWizard] Units synced: ${synced}, renamed: ${renamed}`);
    return NextResponse.json({ synced, renamed });
  } catch (error) {
    log.error('[MappingWizard] Unit sync failed:', error);
    return NextResponse.json({ error: 'Unit sync failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
