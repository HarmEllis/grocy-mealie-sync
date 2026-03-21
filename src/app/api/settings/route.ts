import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { HouseholdsShoppingListsService } from '@/lib/mealie';
import { log } from '@/lib/logger';

export async function GET() {
  const settings = await getSettings();
  const units = await db.select().from(unitMappings);

  let availableShoppingLists: { id: string; name: string }[] = [];
  try {
    const listsRes = await HouseholdsShoppingListsService.getAllApiHouseholdsShoppingListsGet(
      undefined, undefined, 'asc', undefined, undefined, 1, 100
    );
    availableShoppingLists = (listsRes.items || []).map(l => ({
      id: l.id,
      name: l.name || 'Unnamed list',
    }));
  } catch (error) {
    log.warn('[Settings] Could not fetch Mealie shopping lists:', error);
  }

  return NextResponse.json({
    defaultUnitMappingId: settings.defaultUnitMappingId,
    mealieShoppingListId: settings.mealieShoppingListId,
    availableUnits: units.map(u => ({
      id: u.id,
      name: u.mealieUnitName,
      abbreviation: u.mealieUnitAbbreviation,
      grocyUnitId: u.grocyUnitId,
      grocyUnitName: u.grocyUnitName,
    })),
    availableShoppingLists,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  const settings = await getSettings();

  if ('defaultUnitMappingId' in body) {
    const { defaultUnitMappingId } = body;
    if (defaultUnitMappingId !== null && typeof defaultUnitMappingId !== 'string') {
      return NextResponse.json({ error: 'defaultUnitMappingId must be a string or null' }, { status: 400 });
    }
    settings.defaultUnitMappingId = defaultUnitMappingId;
  }

  if ('mealieShoppingListId' in body) {
    const { mealieShoppingListId } = body;
    if (mealieShoppingListId !== null && typeof mealieShoppingListId !== 'string') {
      return NextResponse.json({ error: 'mealieShoppingListId must be a string or null' }, { status: 400 });
    }
    settings.mealieShoppingListId = mealieShoppingListId;
  }

  await saveSettings(settings);

  return NextResponse.json({ status: 'ok', ...settings });
}
