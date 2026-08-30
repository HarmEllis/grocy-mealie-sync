import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  unitMappingsTable: { __table: 'unit_mappings' },
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  mealieUnits: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
  createMealieUnit: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async () => mockState.unitMappingsRows),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        mockState.insertedValues.push(values);
      }),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async () => mockState.grocyUnits),
}));

vi.mock('@/lib/mealie', () => ({
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(async () => ({ items: mockState.mealieUnits })),
    createOneApiUnitsPost: mockState.createMealieUnit,
  },
}));

vi.mock('@/lib/history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
    info: mockState.logInfo,
  },
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

import { POST } from '../units/create-mealie/route';

function post(body: unknown) {
  return POST(new Request('http://localhost/api/mapping-wizard/units/create-mealie', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

describe('mapping wizard Mealie unit create route', () => {
  beforeEach(() => {
    mockState.unitMappingsRows = [];
    mockState.mealieUnits = [];
    mockState.grocyUnits = [];
    mockState.insertedValues = [];
    mockState.createMealieUnit.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('creates the Mealie counterpart of a Grocy unit and maps the two', async () => {
    mockState.grocyUnits = [{ id: 11, name: 'Bak', name_plural: 'Bakken' }];
    mockState.createMealieUnit.mockResolvedValue({ id: 'unit-new', name: 'Bak', abbreviation: 'bk' });

    const response = await post({ grocyUnitIds: [11] });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ created: 1, skipped: 0, failed: 0 });
    expect(mockState.createMealieUnit).toHaveBeenCalledWith({ name: 'Bak', pluralName: 'Bakken' });
    expect(mockState.insertedValues).toEqual([
      expect.objectContaining({
        mealieUnitId: 'unit-new',
        mealieUnitName: 'Bak',
        mealieUnitAbbreviation: 'bk',
        grocyUnitId: 11,
        grocyUnitName: 'Bak',
        conversionFactor: 1,
      }),
    ]);
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_unit_create_mealie',
      status: 'success',
    }));
  });

  it('skips a Grocy unit that a mapping already points at', async () => {
    mockState.grocyUnits = [{ id: 11, name: 'Bak' }];
    mockState.unitMappingsRows = [{ mealieUnitId: 'unit-1', grocyUnitId: 11 }];

    const response = await post({ grocyUnitIds: [11] });

    expect(await response.json()).toEqual({ created: 0, skipped: 1, failed: 0 });
    expect(mockState.createMealieUnit).not.toHaveBeenCalled();
  });

  it('skips a Grocy unit whose name a Mealie unit already carries', async () => {
    // That Mealie unit is mappable from the regular list, so creating a second
    // one under the same name would only add a duplicate.
    mockState.grocyUnits = [{ id: 11, name: 'Liter' }];
    mockState.mealieUnits = [{ id: 'unit-1', name: 'liter', abbreviation: 'l' }];

    const response = await post({ grocyUnitIds: [11] });

    expect(await response.json()).toEqual({ created: 0, skipped: 1, failed: 0 });
    expect(mockState.createMealieUnit).not.toHaveBeenCalled();
  });

  it('does not create the same unit twice when one payload repeats an id', async () => {
    mockState.grocyUnits = [{ id: 11, name: 'Bak' }];
    mockState.createMealieUnit.mockResolvedValue({ id: 'unit-new', name: 'Bak', abbreviation: '' });

    const response = await post({ grocyUnitIds: [11, 11] });

    expect(await response.json()).toEqual({ created: 1, skipped: 1, failed: 0 });
    expect(mockState.createMealieUnit).toHaveBeenCalledTimes(1);
  });

  it('reports a partial run when a Mealie creation fails', async () => {
    mockState.grocyUnits = [
      { id: 11, name: 'Bak' },
      { id: 12, name: 'Krat' },
    ];
    mockState.createMealieUnit
      .mockResolvedValueOnce({ id: 'unit-new', name: 'Bak', abbreviation: '' })
      .mockRejectedValueOnce(new Error('Mealie unavailable'));

    const response = await post({ grocyUnitIds: [11, 12] });

    expect(await response.json()).toEqual({ created: 1, skipped: 0, failed: 1 });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_unit_create_mealie',
      status: 'partial',
      summary: expect.objectContaining({ created: 1, skipped: 0, failed: 1 }),
    }));
  });
});
