import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  clearSchedulerLock: vi.fn(),
  clearSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/mutex', () => ({
  clearSchedulerLock: mockState.clearSchedulerLock,
  clearSyncLock: mockState.clearSyncLock,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: mockState.logError,
  },
}));

import { POST } from './route';

describe('sync unlock route', () => {
  beforeEach(() => {
    mockState.clearSchedulerLock.mockReset();
    mockState.clearSyncLock.mockReset();
    mockState.logError.mockClear();
  });

  it('returns ok when at least one sync lock was cleared', async () => {
    mockState.clearSyncLock.mockReturnValue(false);
    mockState.clearSchedulerLock.mockReturnValue(true);

    const response = await POST();
    const body = await response.json();

    expect(mockState.clearSyncLock).toHaveBeenCalledTimes(1);
    expect(mockState.clearSchedulerLock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      message: 'Sync locks cleared.',
    });
  });

  it('returns skipped when there were no sync locks to clear', async () => {
    mockState.clearSyncLock.mockReturnValue(false);
    mockState.clearSchedulerLock.mockReturnValue(false);

    const response = await POST();
    const body = await response.json();

    expect(mockState.clearSyncLock).toHaveBeenCalledTimes(1);
    expect(mockState.clearSchedulerLock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'skipped',
      message: 'No sync locks were present.',
    });
  });
});
