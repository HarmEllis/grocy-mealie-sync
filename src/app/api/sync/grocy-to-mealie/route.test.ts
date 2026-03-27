import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  pollGrocyForMissingStock: vi.fn(),
  recordHistoryRun: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/grocy-to-mealie', () => ({
  pollGrocyForMissingStock: mockState.pollGrocyForMissingStock,
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

describe('grocy-to-mealie route', () => {
  beforeEach(() => {
    mockState.pollGrocyForMissingStock.mockReset();
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
  });

  it('returns skipped when low-stock sync is skipped because no shopping list is configured', async () => {
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'skipped',
      reason: 'no-shopping-list',
      inPossessionSummary: null,
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
      inPossessionSummary: null,
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

  it('returns partial when low-stock products were skipped because they are not mapped', async () => {
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'partial',
      inPossessionStatus: 'ok',
      inPossessionSummary: null,
      summary: {
        processedProducts: 3,
        ensuredProducts: 2,
        unmappedProducts: 1,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'partial',
      message: 'Grocy→Mealie check partially completed. Skipped 1 low-stock product because it is not mapped.',
      summary: {
        processedProducts: 3,
        ensuredProducts: 2,
        unmappedProducts: 1,
      },
    });
  });

  it('returns partial when the in-possession sync failed', async () => {
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'partial',
      inPossessionStatus: 'error',
      inPossessionSummary: null,
      summary: {
        processedProducts: 1,
        ensuredProducts: 1,
        unmappedProducts: 0,
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'partial',
      message: 'Grocy→Mealie check partially completed. The "In possession" sync failed.',
      summary: {
        processedProducts: 1,
        ensuredProducts: 1,
        unmappedProducts: 0,
      },
    });
  });
});
