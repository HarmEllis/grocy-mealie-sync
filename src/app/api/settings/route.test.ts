import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  unitMappingsTable: { __table: 'unit_mappings' },
  settings: {
    defaultUnitMappingId: null as string | null,
    mealieShoppingListId: null as string | null,
    autoCreateProducts: false,
    autoCreateUnits: false,
    ensureLowStockOnMealieList: false,
    syncMealieInPossession: true,
    mealieInPossessionOnlyAboveMinStock: false,
    mappingWizardMinStockStep: '1',
    stockOnlyMinStock: true,
  },
  savedSettings: null as Record<string, unknown> | null,
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  mealieUnits: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  shoppingLists: [] as Array<Record<string, unknown>>,
  saveSettings: vi.fn(async (nextSettings: Record<string, unknown>) => {
    mockState.savedSettings = nextSettings;
  }),
  resolveDefaultUnitMappingId: vi.fn((storedId: string | null, units: Array<{ id: string }>) =>
    storedId && units.some(unit => unit.id === storedId) ? storedId : null
  ),
  recordHistoryRun: vi.fn(),
  getSyncState: vi.fn(async () => ({
    mealieInPossessionByGrocyProduct: { '1': true },
  })),
  saveSyncState: vi.fn(async () => undefined),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn(async () => ({ ...mockState.settings })),
  getSettingsLocks: vi.fn(() => ({})),
  getSettingLockedMessage: vi.fn((key: string) => `locked:${key}`),
  isSettingLockedByEnv: vi.fn(() => false),
  resolveAutoCreateProducts: vi.fn(async () => false),
  resolveAutoCreateUnits: vi.fn(async () => false),
  resolveDefaultUnitMappingId: mockState.resolveDefaultUnitMappingId,
  resolveEnsureLowStockOnMealieList: vi.fn(async () => false),
  resolveMappingWizardMinStockStep: vi.fn(async () => '1'),
  resolveMealieInPossessionOnlyAboveMinStock: vi.fn(async () => false),
  resolveShoppingListId: vi.fn(async () => null),
  resolveSyncMealieInPossession: vi.fn(async () => true),
  resolveStockOnlyMinStock: vi.fn(async () => true),
  saveSettings: mockState.saveSettings,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async (table: unknown) => {
        if (table === mockState.unitMappingsTable) {
          return mockState.unitMappingsRows;
        }

        throw new Error(`Unexpected table: ${String(table)}`);
      }),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('@/lib/mealie', () => ({
  HouseholdsShoppingListsService: {
    getAllApiHouseholdsShoppingListsGet: vi.fn(async () => ({ items: mockState.shoppingLists })),
  },
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(async () => ({ items: mockState.mealieUnits })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'quantity_units') {
      return mockState.grocyUnits;
    }

    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
}));

vi.mock('@/lib/sync/state', () => ({
  getSyncState: mockState.getSyncState,
  saveSyncState: mockState.saveSyncState,
}));

vi.mock('@/lib/history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    warn: mockState.logWarn,
  },
}));

import { GET, PUT } from './route';

describe('settings route', () => {
  beforeEach(() => {
    mockState.settings.defaultUnitMappingId = null;
    mockState.savedSettings = null;
    mockState.unitMappingsRows = [];
    mockState.mealieUnits = [];
    mockState.grocyUnits = [];
    mockState.shoppingLists = [];
    mockState.saveSettings.mockClear();
    mockState.resolveDefaultUnitMappingId.mockClear();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.getSyncState.mockClear();
    mockState.saveSyncState.mockClear();
    mockState.logWarn.mockClear();
  });

  it('filters stale unit mappings out of the default-unit options', async () => {
    mockState.settings.defaultUnitMappingId = 'unit-map-stale';
    mockState.unitMappingsRows = [
      {
        id: 'unit-map-stale',
        mealieUnitId: 'unit-removed',
        mealieUnitName: 'Fles',
        mealieUnitAbbreviation: 'fl',
        grocyUnitId: 10,
        grocyUnitName: 'Bottle',
      },
      {
        id: 'unit-map-valid',
        mealieUnitId: 'unit-2',
        mealieUnitName: 'Liter',
        mealieUnitAbbreviation: 'l',
        grocyUnitId: 20,
        grocyUnitName: 'Litre',
      },
      {
        id: 'unit-map-missing-grocy',
        mealieUnitId: 'unit-3',
        mealieUnitName: 'Zak',
        mealieUnitAbbreviation: 'zk',
        grocyUnitId: 30,
        grocyUnitName: 'Bag',
      },
    ];
    mockState.mealieUnits = [
      { id: 'unit-2', name: 'Liter', abbreviation: 'l' },
      { id: 'unit-3', name: 'Zak', abbreviation: 'zk' },
    ];
    mockState.grocyUnits = [
      { id: 20, name: 'Litre' },
    ];

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.defaultUnitMappingId).toBeNull();
    expect(body.availableUnits).toEqual([
      {
        id: 'unit-map-valid',
        name: 'Litre',
        abbreviation: 'l',
        grocyUnitId: 20,
        grocyUnitName: 'Litre',
      },
    ]);
  });

  it('records manual history when settings are updated', async () => {
    const response = await PUT(new Request('http://localhost/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        autoCreateProducts: true,
        stockOnlyMinStock: false,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      status: 'ok',
      autoCreateProducts: true,
      stockOnlyMinStock: false,
    }));
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'settings_update',
      status: 'success',
    }));
  });
});
