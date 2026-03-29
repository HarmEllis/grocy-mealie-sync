import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  unitMappingsTable: { __table: 'unit_mappings' },
  unitMappingsRows: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  mealieUnits: [] as Array<Record<string, unknown>>,
  deleteGrocyEntity: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async () => mockState.unitMappingsRows),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async () => mockState.grocyUnits),
  deleteGrocyEntity: mockState.deleteGrocyEntity,
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
    warn: mockState.logWarn,
  },
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

import { POST } from '../units/orphans/route';

describe('mapping wizard orphan unit route', () => {
  beforeEach(() => {
    mockState.unitMappingsRows = [];
    mockState.grocyUnits = [];
    mockState.mealieUnits = [];
    mockState.deleteGrocyEntity.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
    mockState.logWarn.mockClear();
  });

  it('records manual history when orphan Grocy units are deleted', async () => {
    mockState.grocyUnits = [
      { id: 1, name: 'Orphan unit' },
      { id: 2, name: 'Mapped unit' },
    ];
    mockState.mealieUnits = [{ id: 'unit-1', name: 'Liter', abbreviation: 'l' }];
    mockState.unitMappingsRows = [{ grocyUnitId: 2 }];
    mockState.deleteGrocyEntity.mockResolvedValue(undefined);

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/orphans', {
      method: 'POST',
      body: JSON.stringify({
        confirm: true,
        ids: ['1'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 1, total: 1 });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_unit_delete_orphans',
      status: 'success',
    }));
  });

  it('records partial history when one orphan unit deletion fails', async () => {
    mockState.grocyUnits = [
      { id: 1, name: 'Orphan unit' },
      { id: 2, name: 'Second orphan unit' },
      { id: 3, name: 'Third unit' },
      { id: 4, name: 'Fourth unit' },
    ];
    mockState.mealieUnits = [{ id: 'unit-1', name: 'Liter', abbreviation: 'l' }];
    mockState.deleteGrocyEntity
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Delete failed'));

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/orphans', {
      method: 'POST',
      body: JSON.stringify({
        confirm: true,
        ids: ['1', '2'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: 1, total: 2 });
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mapping_unit_delete_orphans',
      status: 'partial',
      summary: expect.objectContaining({
        valid: 2,
        deleted: 1,
        failed: 1,
      }),
    }));
  });
});
