import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  settings: {
    defaultUnitMappingId: null,
    mealieShoppingListId: null,
    autoCreateProducts: false,
    autoCreateUnits: false,
    ensureLowStockOnMealieList: false,
    syncMealieInPossession: true,
    mealieInPossessionOnlyAboveMinStock: false,
    mappingWizardMinStockStep: '1',
    stockOnlyMinStock: true,
  },
  savedSettings: null as Record<string, unknown> | null,
  saveSettings: vi.fn(async (nextSettings: Record<string, unknown>) => {
    mockState.savedSettings = nextSettings;
  }),
  recordHistoryRun: vi.fn(),
  getSyncState: vi.fn(async () => ({
    mealieInPossessionByGrocyProduct: { '1': true },
  })),
  saveSyncState: vi.fn(async () => undefined),
}));

vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn(async () => ({ ...mockState.settings })),
  getSettingsLocks: vi.fn(() => ({})),
  getSettingLockedMessage: vi.fn((key: string) => `locked:${key}`),
  isSettingLockedByEnv: vi.fn(() => false),
  resolveAutoCreateProducts: vi.fn(async () => false),
  resolveAutoCreateUnits: vi.fn(async () => false),
  resolveDefaultUnitMappingId: vi.fn(() => null),
  resolveEnsureLowStockOnMealieList: vi.fn(async () => false),
  resolveMappingWizardMinStockStep: vi.fn(async () => '1'),
  resolveMealieInPossessionOnlyAboveMinStock: vi.fn(async () => false),
  resolveShoppingListId: vi.fn(async () => null),
  resolveSyncMealieInPossession: vi.fn(async () => true),
  resolveStockOnlyMinStock: vi.fn(async () => true),
  saveSettings: mockState.saveSettings,
}));

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('@/lib/db/schema', () => ({
  unitMappings: {},
}));

vi.mock('@/lib/mealie', () => ({
  HouseholdsShoppingListsService: {
    getAllApiHouseholdsShoppingListsGet: vi.fn(),
  },
}));

vi.mock('@/lib/sync/state', () => ({
  getSyncState: mockState.getSyncState,
  saveSyncState: mockState.saveSyncState,
}));

vi.mock('@/lib/history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
}));

import { PUT } from './route';

describe('settings route', () => {
  beforeEach(() => {
    mockState.savedSettings = null;
    mockState.saveSettings.mockClear();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.getSyncState.mockClear();
    mockState.saveSyncState.mockClear();
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
