import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesUnitsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface MappingEntry {
  mealieUnitId: string;
  grocyUnitId: number;
}

export async function POST(request: Request) {
  try {
    const { mappings } = (await request.json()) as { mappings: MappingEntry[] };

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json({ error: 'mappings array is required' }, { status: 400 });
    }

    const [mealieUnitsRes, grocyUnitsRaw] = await Promise.all([
      RecipesUnitsService.getAllApiUnitsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
      ),
      GenericEntityInteractionsService.getObjects('quantity_units' as any),
    ]);
    const mealieUnits: any[] = (mealieUnitsRes as any).items || [];
    const grocyUnits: any[] = Array.isArray(grocyUnitsRaw) ? grocyUnitsRaw : [];

    // Pre-fetch existing unit mappings to avoid N+1 queries
    const existingMappings = await db.select().from(unitMappings);
    const existingByMealieUnitId = new Map(existingMappings.map(m => [m.mealieUnitId, m]));

    let synced = 0;
    let renamed = 0;

    for (const entry of mappings) {
      const mUnit = mealieUnits.find((u: any) => u.id === entry.mealieUnitId);
      const gUnit = grocyUnits.find((u: any) => Number(u.id) === entry.grocyUnitId);
      if (!mUnit || !gUnit) continue;

      const mealieName = mUnit.name || 'Unknown';
      const grocyName = gUnit.name || 'Unknown';

      const existing = existingByMealieUnitId.get(entry.mealieUnitId);

      if (existing) {
        await db.update(unitMappings).set({
          grocyUnitId: entry.grocyUnitId,
          grocyUnitName: grocyName,
          updatedAt: new Date(),
        }).where(eq(unitMappings.mealieUnitId, entry.mealieUnitId));
      } else {
        await db.insert(unitMappings).values({
          id: randomUUID(),
          mealieUnitId: entry.mealieUnitId,
          mealieUnitName: mealieName,
          mealieUnitAbbreviation: mUnit.abbreviation || '',
          grocyUnitId: entry.grocyUnitId,
          grocyUnitName: grocyName,
          conversionFactor: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      synced++;

      // Rename Grocy unit to Mealie name
      if (gUnit.name !== mealieName) {
        try {
          await GenericEntityInteractionsService.putObjects(
            'quantity_units' as any,
            entry.grocyUnitId,
            { name: mealieName, name_plural: mUnit.pluralName || mealieName } as any,
          );
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
  }
}
