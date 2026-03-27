import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  unitMappingsTable: {
    id: 'id',
  },
  existingMapping: null as Record<string, unknown> | null,
  deleteWhereCalls: [] as unknown[],
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  resolveConflictsForMapping: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  unitMappings: mockState.unitMappingsTable,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => mockState.existingMapping ? [mockState.existingMapping] : []),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (clause: unknown) => {
        mockState.deleteWhereCalls.push(clause);
      }),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
  },
}));

vi.mock('@/lib/mapping-conflicts-store', () => ({
  resolveConflictsForMapping: mockState.resolveConflictsForMapping,
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

import { POST } from '../units/unmap/route';

describe('mapping wizard unit unmap route', () => {
  beforeEach(() => {
    mockState.existingMapping = null;
    mockState.deleteWhereCalls = [];
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.resolveConflictsForMapping.mockClear();
    mockState.logError.mockClear();
  });

  it('returns 404 when the unit mapping does not exist', async () => {
    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/unmap', {
      method: 'POST',
      body: JSON.stringify({ id: 'missing-map' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Unit mapping not found' });
    expect(mockState.deleteWhereCalls).toEqual([]);
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('deletes the requested unit mapping', async () => {
    mockState.existingMapping = {
      id: 'unit-map-1',
      mealieUnitName: 'Liter',
      grocyUnitName: 'Liter',
    };

    const response = await POST(new Request('http://localhost/api/mapping-wizard/units/unmap', {
      method: 'POST',
      body: JSON.stringify({ id: 'unit-map-1' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      unmapped: true,
      id: 'unit-map-1',
    });
    expect(mockState.deleteWhereCalls).toHaveLength(1);
    expect(mockState.resolveConflictsForMapping).toHaveBeenCalledWith('unit', 'unit-map-1');
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });
});
