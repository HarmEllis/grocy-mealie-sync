import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { getGrocyEntities } from '@/lib/grocy/types';
import { log } from '@/lib/logger';
import { RecipesUnitsService } from '@/lib/mealie';
import { extractUnits } from '@/lib/mealie/types';
import { unitCreateMealieRequestSchema } from '@/lib/validation';
import { defaultSyncLockDeps, runWithSyncLock } from '@/lib/use-cases/shared/sync-lock';
import { mappingWizardErrorResponse } from '../../helpers';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

export async function POST(request: Request) {
  try {
    // Poll for the lock rather than failing instantly: a chunked bulk run
    // sends many sequential requests and one arriving mid-scheduler-cycle
    // should wait instead of aborting the whole run.
    return await runWithSyncLock(defaultSyncLockDeps, () => createMealieUnits(request), { maxWaitMs: 10_000 });
  } catch (error) {
    return mappingWizardErrorResponse(error);
  }
}

/**
 * Creates the Mealie counterpart of a Grocy unit and maps the two.
 *
 * The mirror of `units/create`, which goes Mealie -> Grocy. Without this
 * direction a Grocy-only unit was unreachable: the Units tab lists Mealie
 * units, so it never appeared there, and it could not be used on a product
 * either, because a product mapping stores a `unitMappingId`.
 */
async function createMealieUnits(request: Request) {

  const history = createManualHistoryRecorder(
    'mapping_unit_create_mealie',
    '[History] Failed to record Mealie unit creation:',
  );

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = unitCreateMealieRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { grocyUnitIds } = parsed.data;
    if (grocyUnitIds.length === 0) {
      return NextResponse.json({ error: 'grocyUnitIds array must not be empty' }, { status: 400 });
    }

    const [grocyUnits, mealieUnitsRes, existingMappings] = await Promise.all([
      getGrocyEntities('quantity_units'),
      RecipesUnitsService.getAllApiUnitsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
      ),
      db.select().from(unitMappings),
    ]);

    const mealieUnits = extractUnits(mealieUnitsRes);
    const mappedGrocyUnitIds = new Set(existingMappings.map(mapping => mapping.grocyUnitId));
    const mealieUnitNames = new Set(mealieUnits.map(unit => (unit.name || '').toLowerCase()).filter(Boolean));

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const grocyUnitId of grocyUnitIds) {
      // The unique index on grocy_unit_id would reject the second mapping, and
      // a duplicate id inside one payload has to be caught here too.
      if (mappedGrocyUnitIds.has(grocyUnitId)) {
        skipped++;
        continue;
      }

      const grocyUnit = grocyUnits.find(unit => Number(unit.id) === grocyUnitId);
      if (!grocyUnit) {
        skipped++;
        continue;
      }

      const name = grocyUnit.name || 'Unknown';

      // A Mealie unit under this name already exists, so it is mappable from
      // the regular list. Creating a second one would only add a duplicate.
      if (mealieUnitNames.has(name.toLowerCase())) {
        skipped++;
        continue;
      }

      try {
        const createdUnit = await RecipesUnitsService.createOneApiUnitsPost({
          name,
          pluralName: grocyUnit.name_plural || null,
        });

        await db.insert(unitMappings).values({
          id: randomUUID(),
          mealieUnitId: createdUnit.id,
          mealieUnitName: createdUnit.name || name,
          mealieUnitAbbreviation: createdUnit.abbreviation || '',
          grocyUnitId,
          grocyUnitName: name,
          conversionFactor: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Claim both sides inside this request too, so a duplicate id in one
        // payload cannot create the same Mealie unit twice.
        mappedGrocyUnitIds.add(grocyUnitId);
        mealieUnitNames.add(name.toLowerCase());
        created++;
      } catch (error) {
        failed++;
        log.error(`[MappingWizard] Failed to create Mealie unit "${name}":`, error);
      }
    }

    const status = failed > 0 ? 'partial' : 'success';

    await history.recordOutcome({
      status,
      logLevel: 'info',
      logMessage: `[MappingWizard] Mealie units created from Grocy: ${created}, skipped: ${skipped}, failed: ${failed}`,
      message: failed > 0
        ? `Created ${created} Mealie unit mapping(s); skipped ${skipped}; failed ${failed}.`
        : `Created ${created} Mealie unit mapping(s); skipped ${skipped}.`,
      summary: {
        requested: grocyUnitIds.length,
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
            ? `Created ${created} Mealie unit(s) from Grocy units; ${failed} failed.`
            : `Created ${created} Mealie unit(s) from Grocy units.`,
          details: { requested: grocyUnitIds.length, created, skipped, failed },
        }),
      ],
    });
    return NextResponse.json({ created, skipped, failed });
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Creating Mealie units from Grocy failed:',
      error,
      message: `Mealie unit creation failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: 'Mealie unit creation failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Creating Mealie units failed' }, { status: 500 });
  }
}
