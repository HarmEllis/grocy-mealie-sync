import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  reconcileMealieInPossessionFromGrocy: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/mealie-in-possession', () => ({
  reconcileMealieInPossessionFromGrocy: mockState.reconcileMealieInPossessionFromGrocy,
}));

vi.mock('@/lib/history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
}));

vi.mock('@/lib/sync/mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
  },
}));

import { POST } from './route';

describe('grocy-to-mealie in-possession route', () => {
  beforeEach(() => {
    mockState.reconcileMealieInPossessionFromGrocy.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
  });

  it('returns a partial response when some products fail to update', async () => {
    mockState.reconcileMealieInPossessionFromGrocy.mockResolvedValue({
      status: 'ok',
      reason: undefined,
      summary: {
        processedProducts: 6,
        updatedProducts: 3,
        enabledProducts: 2,
        disabledProducts: 1,
        unchangedProducts: 2,
        failedProducts: 1,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'partial',
      message: 'Reconciled Mealie "In possession" for 3 products (2 enabled, 1 disabled). Failed 1 product.',
      summary: {
        processedProducts: 6,
        updatedProducts: 3,
        enabledProducts: 2,
        disabledProducts: 1,
        unchangedProducts: 2,
        failedProducts: 1,
      },
    });
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });
});
