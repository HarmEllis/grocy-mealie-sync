import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesUnitsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface CreateRequest {
  mealieUnitIds: string[];
}

export async function POST(request: Request) {
  try {
    const { mealieUnitIds } = (await request.json()) as CreateRequest;

    if (!Array.isArray(mealieUnitIds) || mealieUnitIds.length === 0) {
      return NextResponse.json({ error: 'mealieUnitIds array is required' }, { status: 400 });
    }

    const mealieUnitsRes = await RecipesUnitsService.getAllApiUnitsGet(
      undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
    );
    const mealieUnits: any[] = (mealieUnitsRes as any).items || [];

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

      const mUnit = mealieUnits.find((u: any) => u.id === mealieUnitId);
      if (!mUnit) continue;

      const name = mUnit.name || 'Unknown';

      try {
        const result = await GenericEntityInteractionsService.postObjects(
          'quantity_units' as any,
          { name, name_plural: mUnit.pluralName || name } as any,
        );

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
  }
}
