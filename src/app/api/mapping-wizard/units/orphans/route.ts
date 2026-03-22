import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { GenericEntityInteractionsService } from '@/lib/grocy';
import { RecipesUnitsService } from '@/lib/mealie';
import { log } from '@/lib/logger';

export async function DELETE() {
  try {
    const [grocyUnitsRaw, mealieUnitsRes, existingMappings] = await Promise.all([
      GenericEntityInteractionsService.getObjects('quantity_units' as any),
      RecipesUnitsService.getAllApiUnitsGet(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 1000,
      ),
      db.select().from(unitMappings),
    ]);

    const grocyUnits: any[] = Array.isArray(grocyUnitsRaw) ? grocyUnitsRaw : [];
    const mealieUnits: any[] = (mealieUnitsRes as any).items || [];
    const mealieUnitNames = new Set(mealieUnits.flatMap((u: any) => [
      (u.name || '').toLowerCase(),
      (u.abbreviation || '').toLowerCase(),
    ].filter(Boolean)));
    const mappedGrocyUnitIds = new Set(existingMappings.map(m => m.grocyUnitId));

    // Orphans: Grocy units that are neither mapped nor have a Mealie counterpart by name
    const orphans = grocyUnits.filter((u: any) => {
      const id = Number(u.id);
      const name = (u.name || '').toLowerCase();
      return !mappedGrocyUnitIds.has(id) && !mealieUnitNames.has(name);
    });

    let deleted = 0;
    for (const orphan of orphans) {
      try {
        await GenericEntityInteractionsService.deleteObjects('quantity_units' as any, Number(orphan.id));
        deleted++;
      } catch (e) {
        log.error(`[MappingWizard] Failed to delete Grocy unit ${orphan.id} "${orphan.name}":`, e);
      }
    }

    log.info(`[MappingWizard] Orphan units deleted: ${deleted}/${orphans.length}`);
    return NextResponse.json({ deleted, total: orphans.length });
  } catch (error) {
    log.error('[MappingWizard] Orphan unit deletion failed:', error);
    return NextResponse.json({ error: 'Orphan unit deletion failed' }, { status: 500 });
  }
}
