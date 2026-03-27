import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  clearSyncLock: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sync/mutex', () => ({
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
    mockState.clearSyncLock.mockReset();
    mockState.logError.mockClear();
  });

  it('returns ok when a sync lock was cleared', async () => {
    mockState.clearSyncLock.mockReturnValue(true);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      message: 'Sync lock cleared.',
    });
  });

  it('returns skipped when there was no sync lock to clear', async () => {
    mockState.clearSyncLock.mockReturnValue(false);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'skipped',
      message: 'No sync lock was present.',
    });
  });
});
