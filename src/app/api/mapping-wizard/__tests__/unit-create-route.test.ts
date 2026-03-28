import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  unitMappingsTable: { __table: 'unit_mappings' },
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  mealieUnits: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
  createGrocyEntity: vi.fn(),
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
  createGrocyEntity: mockState.createGrocyEntity,
}));

vi.mock('@/lib/mealie', () => ({
  RecipesUnitsService: {
    getAllApiUnitsGet: vi.fn(async () => ({ items: mockState.mealieUnits })),
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

import { POST } from '../units/create/route';

describe('mapping wizard unit create route', () => {
  beforeEach(() => {
    mockState.unitMappingsRows = [];
    mockState.mealieUnits = [];
    mockState.insertedValues = [];
    mockState.createGrocyEntity.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('records manual history when Grocy units are created from Mealie units', async () => {
    mockState.mealieUnits = [
      { id: 'unit-1', name: 'Bottle', pluralName: 'Bottles', abbreviation: 'btl' },
      { id: 'unit-2', name: 'Mapped', pluralName: 'Mapped', abbreviation: 'm' },
    ];
    mockState.unitMappingsRows = [{ mealieUnitId: 'unit-2' }];
    mockState.createGrocyEntity.mockResolvedValue({ created_object_id: 33 });

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/create', {
      method: 'POST',
      body: JSON.stringify({
        mealieUnitIds: ['unit-1', 'unit-2'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ created: 1, skipped: 1 });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_unit_create',
      status: 'success',
    }));
  });
});
