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
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  const history = createManualHistoryRecorder(
    'mapping_unit_create',
    '[History] Failed to record unit creation:',
  );
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
    let failed = 0;

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
        failed++;
        log.error(`[MappingWizard] Failed to create Grocy unit "${name}":`, e);
      }
    }

    const status = failed > 0 ? 'partial' : 'success';

    await history.recordOutcome({
      status,
      logLevel: 'info',
      logMessage: `[MappingWizard] Units created: ${created}, skipped: ${skipped}, failed: ${failed}`,
      message: failed > 0
        ? `Created ${created} Grocy unit mapping(s); skipped ${skipped}; failed ${failed}.`
        : `Created ${created} Grocy unit mapping(s); skipped ${skipped}.`,
      summary: {
        requested: mealieUnitIds.length,
        created,
        skipped,
        failed,
      },
      events: [
        buildManualHistoryEvent({
          level: failed > 0 ? 'warning' : 'info',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: failed > 0
            ? `Created ${created} Grocy unit(s) from Mealie units; ${failed} failed.`
            : `Created ${created} Grocy unit(s) from Mealie units.`,
          details: { requested: mealieUnitIds.length, created, skipped, failed },
        }),
      ],
    });
    return NextResponse.json({ created, skipped });
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Unit creation failed:',
      error,
      message: `Grocy unit creation failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: 'Grocy unit creation failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Unit creation failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
