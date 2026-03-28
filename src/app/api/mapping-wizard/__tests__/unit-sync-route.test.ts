import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  unitMappingsTable: {
    mealieUnitId: 'mealie_unit_id',
  },
  mealieUnits: [] as Array<Record<string, unknown>>,
  grocyUnits: [] as Array<Record<string, unknown>>,
  existingUnitMappings: [] as Array<Record<string, unknown>>,
  insertValuesCalls: [] as Array<Record<string, unknown>>,
  conflictCalls: [] as Array<Record<string, unknown>>,
  updateGrocyEntity: vi.fn().mockResolvedValue(undefined),
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
      from: vi.fn(async () => mockState.existingUnitMappings),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mockState.insertValuesCalls.push(values);
        return {
          onConflictDoUpdate: vi.fn(async (args: Record<string, unknown>) => {
            mockState.conflictCalls.push(args);
          }),
        };
      }),
    })),
  },
}));

vi.mock('@/lib/grocy/types', () => ({
  getGrocyEntities: vi.fn(async (entity: string) => {
    if (entity === 'quantity_units') {
      return mockState.grocyUnits;
    }

    throw new Error(`Unexpected Grocy entity: ${entity}`);
  }),
  updateGrocyEntity: mockState.updateGrocyEntity,
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

import { POST } from '../units/sync/route';

describe('mapping wizard unit sync route', () => {
  beforeEach(() => {
    mockState.mealieUnits = [];
    mockState.grocyUnits = [];
    mockState.existingUnitMappings = [];
    mockState.insertValuesCalls = [];
    mockState.conflictCalls = [];

    mockState.updateGrocyEntity.mockClear();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
    mockState.logInfo.mockClear();
  });

  it('returns 409 when a Grocy unit is already mapped to another Mealie unit', async () => {
    mockState.mealieUnits = [
      { id: 'unit-1', name: 'Liter', abbreviation: 'l' },
    ];
    mockState.grocyUnits = [
      { id: 10, name: 'Liter' },
    ];
    mockState.existingUnitMappings = [
      {
        mealieUnitId: 'unit-2',
        mealieUnitName: 'Other unit',
        grocyUnitId: 10,
        grocyUnitName: 'Liter',
      },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieUnitId: 'unit-1', grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Grocy unit "Liter" (#10) is already mapped to Mealie unit "Other unit".',
      conflict: {
        grocyUnitId: 10,
        mealieUnitId: 'unit-2',
      },
    });
    expect(mockState.insertValuesCalls).toHaveLength(0);
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when the same Grocy unit is selected for multiple Mealie units in one request', async () => {
    mockState.mealieUnits = [
      { id: 'unit-1', name: 'Liter', abbreviation: 'l' },
      { id: 'unit-2', name: 'Bottle', abbreviation: 'btl' },
    ];
    mockState.grocyUnits = [
      { id: 10, name: 'Liter' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieUnitId: 'unit-1', grocyUnitId: 10 },
          { mealieUnitId: 'unit-2', grocyUnitId: 10 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Grocy unit #10 is selected for multiple Mealie units in the same request.',
      conflict: {
        grocyUnitId: 10,
        mealieUnitIds: ['unit-1', 'unit-2'],
      },
    });
    expect(mockState.insertValuesCalls).toHaveLength(0);
  });

  it('records manual history for a successful unit mapping sync', async () => {
    mockState.mealieUnits = [
      { id: 'unit-1', name: 'Liter', abbreviation: 'l', pluralName: 'Liters' },
    ];
    mockState.grocyUnits = [
      { id: 10, name: 'Liter' },
    ];

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/sync', {
      method: 'POST',
      body: JSON.stringify({
        mappings: [
          { mealieUnitId: 'unit-1', grocyUnitId: 10 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_unit_sync',
      status: 'success',
    }));
  });
});
