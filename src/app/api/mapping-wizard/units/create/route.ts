import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { createGrocyEntity } from '@/lib/grocy/types';
import { RecipesUnitsService } from '@/lib/mealie';
import { extractUnits } from '@/lib/mealie/types';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { unitCreateRequestSchema } from '@/lib/validation';
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

    const parsed = unitCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { mealieUnitIds } = parsed.data;

    if (mealieUnitIds.length === 0) {
      return NextResponse.json({ error: 'mealieUnitIds array must not be empty' }, { status: 400 });
    }

    const mealieUnitsRes = await RecipesUnitsService.getAllApiUnitsGet(
      undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
    );
    const mealieUnits = extractUnits(mealieUnitsRes);

    // Pre-fetch existing unit mappings to avoid N+1 queries
    const existingMappings = await db.select().from(unitMappings);
    const mappedMealieUnitIds = new Set(existingMappings.map(m => m.mealieUnitId));

    let created = 0;
    let skipped = 0;

    for (const mealieUnitId of mealieUnitIds) {
      if (mappedMealieUnitIds.has(mealieUnitId)) {
        skipped++;
        continue;
      }

      const mUnit = mealieUnits.find(u => u.id === mealieUnitId);
      if (!mUnit) continue;

      const name = mUnit.name || 'Unknown';

      try {
        const result = await createGrocyEntity('quantity_units', {
          name,
          name_plural: mUnit.pluralName || name,
        });

        await db.insert(unitMappings).values({
          id: randomUUID(),
          mealieUnitId,
          mealieUnitName: name,
          mealieUnitAbbreviation: mUnit.abbreviation || '',
          grocyUnitId: Number(result.created_object_id),
          grocyUnitName: name,
          conversionFactor: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        created++;
      } catch (e) {
        log.error(`[MappingWizard] Failed to create Grocy unit "${name}":`, e);
      }
    }

    log.info(`[MappingWizard] Units created: ${created}, skipped: ${skipped}`);
    return NextResponse.json({ created, skipped });
  } catch (error) {
    log.error('[MappingWizard] Unit creation failed:', error);
    return NextResponse.json({ error: 'Unit creation failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
