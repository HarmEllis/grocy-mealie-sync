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
import {
  findDuplicateGrocyUnitAssignment,
  findUnitMappingConflict,
  formatUnitMappingConflictMessage,
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
    'mapping_unit_sync',
    '[History] Failed to record unit mapping sync:',
  );
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

    const [mealieUnitsRes, grocyUnits, existingMappings] = await Promise.all([
      RecipesUnitsService.getAllApiUnitsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
      ),
      getGrocyEntities('quantity_units'),
      db.select().from(unitMappings),
    ]);
    const mealieUnits = extractUnits(mealieUnitsRes);

    const duplicateAssignment = findDuplicateGrocyUnitAssignment(mappings);
    if (duplicateAssignment) {
      return NextResponse.json(
        {
          error: `Grocy unit #${duplicateAssignment.grocyUnitId} is selected for multiple Mealie units in the same request.`,
          conflict: duplicateAssignment,
        },
        { status: 409 },
      );
    }

    for (const entry of mappings) {
      const conflict = findUnitMappingConflict(existingMappings, entry.mealieUnitId, entry.grocyUnitId);
      if (conflict) {
        return NextResponse.json(
          {
            error: formatUnitMappingConflictMessage(conflict, entry.grocyUnitId),
            conflict: {
              grocyUnitId: entry.grocyUnitId,
              mealieUnitId: conflict.mealieUnitId,
            },
          },
          { status: 409 },
        );
      }
    }

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

    await history.recordSuccess({
      logMessage: `[MappingWizard] Units synced: ${synced}, renamed: ${renamed}`,
      message: `Mapped ${synced} unit(s); renamed ${renamed}.`,
      summary: {
        requested: mappings.length,
        synced,
        renamed,
      },
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: `Mapped ${synced} unit(s).`,
          details: { requested: mappings.length, synced, renamed },
        }),
      ],
    });
    return NextResponse.json({ synced, renamed });
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Unit sync failed:',
      error,
      message: `Unit mapping sync failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: 'Unit mapping sync failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Unit sync failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
