import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  listOpenMappingConflicts: vi.fn(),
  runMappingConflictCheck: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/mapping-conflicts-store', () => ({
  listOpenMappingConflicts: mockState.listOpenMappingConflicts,
  runMappingConflictCheck: mockState.runMappingConflictCheck,
}));

vi.mock('@/lib/history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
  },
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

import { GET, POST } from '../conflicts/route';

describe('mapping wizard conflicts route', () => {
  beforeEach(() => {
    mockState.listOpenMappingConflicts.mockReset();
    mockState.runMappingConflictCheck.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
  });

  it('returns open conflicts on GET', async () => {
    mockState.listOpenMappingConflicts.mockResolvedValue([
      {
        id: 'conflict-1',
        conflictKey: 'missing_mealie_food:product:product-map-1',
        type: 'missing_mealie_food',
        status: 'open',
        severity: 'error',
        mappingKind: 'product',
        mappingId: 'product-map-1',
        sourceTab: 'products',
        mealieId: 'food-1',
        mealieName: 'Milk',
        grocyId: 101,
        grocyName: 'Milk',
        summary: 'Mapped Mealie product "Milk" no longer exists.',
        occurrences: 2,
        firstSeenAt: new Date('2026-03-27T10:00:00.000Z'),
        lastSeenAt: new Date('2026-03-27T10:05:00.000Z'),
        resolvedAt: null,
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0]).toMatchObject({
      id: 'conflict-1',
      type: 'missing_mealie_food',
      mappingKind: 'product',
      mappingId: 'product-map-1',
    });
  });

  it('runs a conflict check on POST', async () => {
    mockState.runMappingConflictCheck.mockResolvedValue({
      conflicts: [],
      openedConflicts: [],
      resolvedConflicts: [],
      summary: {
        detected: 3,
        opened: 1,
        resolved: 2,
        open: 0,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      conflicts: [],
      openedConflicts: [],
      resolvedConflicts: [],
      summary: {
        detected: 3,
        opened: 1,
        resolved: 2,
        open: 0,
      },
    });
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });
});
