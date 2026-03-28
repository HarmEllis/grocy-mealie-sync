import { NextResponse } from 'next/server';
import {
  getSettings,
  getSettingsLocks,
  getSettingLockedMessage,
  isSettingLockedByEnv,
  resolveAutoCreateProducts,
  resolveAutoCreateUnits,
  resolveDefaultUnitMappingId,
  resolveEnsureLowStockOnMealieList,
  resolveMappingWizardMinStockStep,
  resolveMealieInPossessionOnlyAboveMinStock,
  resolveShoppingListId,
  resolveSyncMealieInPossession,
  resolveStockOnlyMinStock,
  saveSettings,
} from '@/lib/settings';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { HouseholdsShoppingListsService } from '@/lib/mealie';
import { log } from '@/lib/logger';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';
import { settingsUpdateSchema } from '@/lib/validation';
import { getSyncState, saveSyncState } from '@/lib/sync/state';

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
  const ensureLowStockOnMealieList = await resolveEnsureLowStockOnMealieList();
  const syncMealieInPossession = await resolveSyncMealieInPossession();
  const mealieInPossessionOnlyAboveMinStock = await resolveMealieInPossessionOnlyAboveMinStock();
  const mappingWizardMinStockStep = await resolveMappingWizardMinStockStep();
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
    ensureLowStockOnMealieList,
    syncMealieInPossession,
    mealieInPossessionOnlyAboveMinStock,
    mappingWizardMinStockStep,
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

  const data = parsed.data;
  const updatedFields = Object.keys(data).filter((key) => data[key as keyof typeof data] !== undefined);
  const history = createManualHistoryRecorder(
    'settings_update',
    '[History] Failed to record settings update:',
  );

  try {
    const settings = await getSettings();

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

    if (data.ensureLowStockOnMealieList !== undefined) {
      settings.ensureLowStockOnMealieList = data.ensureLowStockOnMealieList;
    }

    if (data.syncMealieInPossession !== undefined) {
      settings.syncMealieInPossession = data.syncMealieInPossession;
    }

    if (data.mealieInPossessionOnlyAboveMinStock !== undefined) {
      settings.mealieInPossessionOnlyAboveMinStock = data.mealieInPossessionOnlyAboveMinStock;
    }

    if (data.mappingWizardMinStockStep !== undefined) {
      settings.mappingWizardMinStockStep = data.mappingWizardMinStockStep;
    }

    if (data.stockOnlyMinStock !== undefined) {
      settings.stockOnlyMinStock = data.stockOnlyMinStock;
    }

    await saveSettings(settings);

    if (data.syncMealieInPossession === false) {
      const syncState = await getSyncState();
      syncState.mealieInPossessionByGrocyProduct = {};
      await saveSyncState(syncState);
    }

    await history.record({
      status: 'success',
      message: `Updated ${updatedFields.length} setting(s).`,
      summary: {
        updatedFields,
        resetMealieInPossessionState: data.syncMealieInPossession === false,
      },
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'system',
          entityKind: 'system',
          entityRef: 'settings',
          message: `Updated settings: ${updatedFields.join(', ') || 'none'}.`,
          details: { updatedFields },
        }),
        ...(data.syncMealieInPossession === false
          ? [buildManualHistoryEvent({
            level: 'info',
            category: 'system',
            entityKind: 'system',
            entityRef: 'sync-state',
            message: 'Cleared Mealie in-possession sync state after disabling the feature.',
          })]
          : []),
      ],
    });

    return NextResponse.json({ status: 'ok', ...settings });
  } catch (error) {
    log.error('[Settings] Failed to update settings:', error);
    await history.record({
      status: 'failure',
      message: `Settings update failed: ${formatManualActionError(error)}`,
      summary: {
        updatedFields,
        error: formatManualActionError(error),
      },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'system',
          entityKind: 'system',
          entityRef: 'settings',
          message: 'Settings update failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
