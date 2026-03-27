import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  pollGrocyForMissingStock: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/grocy-to-mealie', () => ({
  pollGrocyForMissingStock: mockState.pollGrocyForMissingStock,
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

describe('grocy-to-mealie route', () => {
  beforeEach(() => {
    mockState.pollGrocyForMissingStock.mockReset();
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
  });

  it('returns skipped when low-stock sync is skipped because no shopping list is configured', async () => {
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'skipped',
      reason: 'no-shopping-list',
      summary: {
        processedProducts: 0,
        ensuredProducts: 0,
        unmappedProducts: 0,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'skipped',
      message: 'No shopping list is configured, so the low-stock shopping-list sync was skipped.',
      summary: {
        processedProducts: 0,
        ensuredProducts: 0,
        unmappedProducts: 0,
      },
    });
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the poller reports an error result', async () => {
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'error',
      summary: {
        processedProducts: 0,
        ensuredProducts: 0,
        unmappedProducts: 0,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: 'error',
      message: 'An internal error occurred during Grocy-to-Mealie sync',
    });
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });
});
