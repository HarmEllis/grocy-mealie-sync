import { NextResponse } from 'next/server';
import {
  getSettings,
  getSettingsLocks,
  getSettingLockedMessage,
  isSettingLockedByEnv,
  resolveAutoCreateProducts,
  resolveAutoCreateUnits,
  resolveDefaultUnitMappingId,
  resolveShoppingListId,
  resolveStockOnlyMinStock,
  saveSettings,
} from '@/lib/settings';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { HouseholdsShoppingListsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { settingsUpdateSchema } from '@/lib/validation';

export async function GET() {
  const settings = await getSettings();
  const units = await db.select().from(unitMappings);
  const locks = getSettingsLocks();

  // Resolve effective values (env var > DB setting)
  const effectiveShoppingListId = await resolveShoppingListId();
  const effectiveDefaultUnitId = resolveDefaultUnitMappingId(
    settings.defaultUnitMappingId,
    units.map(u => ({ id: u.id, grocyUnitId: u.grocyUnitId })),
  );
  const autoCreateProducts = await resolveAutoCreateProducts();
  const autoCreateUnits = await resolveAutoCreateUnits();
  const stockOnlyMinStock = await resolveStockOnlyMinStock();

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
    autoCreateProducts,
    autoCreateUnits,
    stockOnlyMinStock,
    locks,
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

  for (const key of Object.keys(data) as (keyof typeof data)[]) {
    if (data[key] !== undefined && isSettingLockedByEnv(key)) {
      const locks = getSettingsLocks();
      return NextResponse.json(
        {
          error: getSettingLockedMessage(key),
          field: key,
          envVar: locks[key].envVar,
        },
        { status: 409 },
      );
    }
  }

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

  if (data.stockOnlyMinStock !== undefined) {
    settings.stockOnlyMinStock = data.stockOnlyMinStock;
  }

  await saveSettings(settings);

  return NextResponse.json({ status: 'ok', ...settings });
}
