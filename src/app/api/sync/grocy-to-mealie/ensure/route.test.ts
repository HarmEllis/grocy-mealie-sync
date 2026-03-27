import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  ensureGrocyMissingStockOnMealie: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/grocy-to-mealie', () => ({
  ensureGrocyMissingStockOnMealie: mockState.ensureGrocyMissingStockOnMealie,
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

describe('grocy-to-mealie ensure route', () => {
  beforeEach(() => {
    mockState.ensureGrocyMissingStockOnMealie.mockReset();
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockClear();
    mockState.logError.mockClear();
  });

  it('returns a partial response with ensure counts when products are unmapped', async () => {
    mockState.ensureGrocyMissingStockOnMealie.mockResolvedValue({
      status: 'ok',
      summary: {
        processedProducts: 4,
        ensuredProducts: 3,
        unmappedProducts: 1,
      },
    });

    const response = await POST(new Request('http://localhost/api/sync/grocy-to-mealie/ensure', {
      method: 'POST',
      headers: {
        'x-sync-trigger': 'ui',
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'partial',
      message: 'Ensured 3 low-stock products in Mealie. Skipped 1 product because it is not mapped.',
      summary: {
        processedProducts: 4,
        ensuredProducts: 3,
        unmappedProducts: 1,
      },
    });
    expect(mockState.ensureGrocyMissingStockOnMealie).toHaveBeenCalledWith({
      logUnmappedPresenceCheckProducts: true,
    });
    expect(mockState.releaseSyncLock).toHaveBeenCalledTimes(1);
  });

  it('does not enable per-product presence-check mapping logs without the UI trigger header', async () => {
    mockState.ensureGrocyMissingStockOnMealie.mockResolvedValue({
      status: 'ok',
      summary: {
        processedProducts: 0,
        ensuredProducts: 0,
        unmappedProducts: 0,
      },
    });

    await POST(new Request('http://localhost/api/sync/grocy-to-mealie/ensure', {
      method: 'POST',
    }));

    expect(mockState.ensureGrocyMissingStockOnMealie).toHaveBeenCalledWith({
      logUnmappedPresenceCheckProducts: false,
    });
  });
});
