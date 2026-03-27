import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  pollMealieForCheckedItems: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/mealie-to-grocy', () => ({
  pollMealieForCheckedItems: mockState.pollMealieForCheckedItems,
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

describe('mealie-to-grocy route', () => {
  beforeEach(() => {
    mockState.pollMealieForCheckedItems.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
  });

  it('returns a partial response when some checked items fail', async () => {
    mockState.pollMealieForCheckedItems.mockResolvedValue({
      status: 'partial',
      summary: {
        checkedItems: 3,
        restockedProducts: 2,
        failedItems: 1,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'partial',
      message: 'Processed 2 checked Mealie items. Failed 1 item.',
      summary: {
        checkedItems: 3,
        restockedProducts: 2,
        failedItems: 1,
      },
    });
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('returns skipped when no shopping list is configured', async () => {
    mockState.pollMealieForCheckedItems.mockResolvedValue({
      status: 'skipped',
      reason: 'no-shopping-list',
      summary: {
        checkedItems: 0,
        restockedProducts: 0,
        failedItems: 0,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'skipped',
      message: 'No shopping list is configured, so the Mealie-to-Grocy check was skipped.',
      summary: {
        checkedItems: 0,
        restockedProducts: 0,
        failedItems: 0,
      },
    });
  });
});
