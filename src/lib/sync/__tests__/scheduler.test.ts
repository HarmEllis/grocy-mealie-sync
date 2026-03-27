import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    pollIntervalSeconds: 10,
    productSyncIntervalHours: 6,
  },
  runFullProductSync: vi.fn(),
  runMappingConflictCheck: vi.fn(),
  pollGrocyForMissingStock: vi.fn(),
  pollMealieForCheckedItems: vi.fn(),
  acquireSyncLock: vi.fn(() => true),
  releaseSyncLock: vi.fn(),
  acquireSchedulerLock: vi.fn(),
  releaseSchedulerLock: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../config', () => ({
  config: mockState.config,
}));

vi.mock('../product-sync', () => ({
  runFullProductSync: mockState.runFullProductSync,
}));

vi.mock('../../mapping-conflicts-store', () => ({
  runMappingConflictCheck: mockState.runMappingConflictCheck,
}));

vi.mock('../grocy-to-mealie', () => ({
  pollGrocyForMissingStock: mockState.pollGrocyForMissingStock,
}));

vi.mock('../mealie-to-grocy', () => ({
  pollMealieForCheckedItems: mockState.pollMealieForCheckedItems,
}));

vi.mock('../mutex', () => ({
  acquireSyncLock: mockState.acquireSyncLock,
  releaseSyncLock: mockState.releaseSyncLock,
  acquireSchedulerLock: mockState.acquireSchedulerLock,
  releaseSchedulerLock: mockState.releaseSchedulerLock,
}));

vi.mock('../../logger', () => ({
  log: {
    info: mockState.logInfo,
    warn: mockState.logWarn,
    error: mockState.logError,
  },
}));

import { startScheduler, stopScheduler } from '../scheduler';

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('scheduler startup lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockState.runFullProductSync.mockReset();
    mockState.runFullProductSync.mockResolvedValue(undefined);
    mockState.runMappingConflictCheck.mockReset();
    mockState.runMappingConflictCheck.mockResolvedValue({
      conflicts: [],
      summary: {
        detected: 0,
        opened: 0,
        resolved: 0,
        open: 0,
      },
    });
    mockState.pollGrocyForMissingStock.mockReset();
    mockState.pollGrocyForMissingStock.mockResolvedValue(undefined);
    mockState.pollMealieForCheckedItems.mockReset();
    mockState.pollMealieForCheckedItems.mockResolvedValue(undefined);
    mockState.acquireSyncLock.mockReset();
    mockState.acquireSyncLock.mockReturnValue(true);
    mockState.releaseSyncLock.mockReset();
    mockState.acquireSchedulerLock.mockReset();
    mockState.releaseSchedulerLock.mockReset();
    mockState.logInfo.mockReset();
    mockState.logWarn.mockReset();
    mockState.logError.mockReset();
  });

  afterEach(() => {
    stopScheduler();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('starts the scheduler only when the startup lock is acquired', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);

    startScheduler();
    await flushAsyncWork();

    expect(mockState.runFullProductSync).toHaveBeenCalledTimes(1);
    expect(mockState.runMappingConflictCheck).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    await flushAsyncWork();

    expect(mockState.pollMealieForCheckedItems).toHaveBeenCalledTimes(1);
    expect(mockState.pollGrocyForMissingStock).toHaveBeenCalledTimes(1);
    expect(mockState.runMappingConflictCheck).toHaveBeenCalledTimes(2);
    expect(mockState.acquireSchedulerLock).toHaveBeenCalledTimes(1);
  });

  it('stays passive when another instance already owns the scheduler startup lock', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(false);

    startScheduler();
    await flushAsyncWork();

    expect(mockState.runFullProductSync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    await flushAsyncWork();

    expect(mockState.pollMealieForCheckedItems).not.toHaveBeenCalled();
    expect(mockState.pollGrocyForMissingStock).not.toHaveBeenCalled();
    expect(mockState.acquireSchedulerLock).toHaveBeenCalledTimes(1);
  });

  it('releases the scheduler startup lock when stopping an active scheduler', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);

    startScheduler();
    await flushAsyncWork();
    stopScheduler();

    expect(mockState.releaseSchedulerLock).toHaveBeenCalledTimes(1);
  });
});
