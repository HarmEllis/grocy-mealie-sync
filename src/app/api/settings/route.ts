import { NextResponse } from 'next/server';
import { getSettings, saveSettings, resolveShoppingListId } from '@/lib/settings';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { HouseholdsShoppingListsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { settingsUpdateSchema } from '@/lib/validation';
import { config } from '@/lib/config';

export async function GET() {
  const settings = await getSettings();
  const units = await db.select().from(unitMappings);

  // Resolve effective shopping list ID (DB setting > env var)
  const effectiveShoppingListId = await resolveShoppingListId();
  // Resolve effective default unit (DB setting > env var)
  const effectiveDefaultUnitId = settings.defaultUnitMappingId;

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
    defaultUnitMappingId: effectiveDefaultUnitId,
    mealieShoppingListId: effectiveShoppingListId,
    autoCreateProducts: settings.autoCreateProducts,
    autoCreateUnits: settings.autoCreateUnits,
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const settings = await getSettings();
  const data = parsed.data;

  if (data.defaultUnitMappingId !== undefined) {
    settings.defaultUnitMappingId = data.defaultUnitMappingId ?? null;
  }

  if (data.mealieShoppingListId !== undefined) {
    settings.mealieShoppingListId = data.mealieShoppingListId ?? null;
  }

  if (data.autoCreateProducts !== undefined) {
    settings.autoCreateProducts = data.autoCreateProducts;
  }

  if (data.autoCreateUnits !== undefined) {
    settings.autoCreateUnits = data.autoCreateUnits;
  }

  await saveSettings(settings);

  return NextResponse.json({ status: 'ok', ...settings });
}
