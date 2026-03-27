import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    pollIntervalSeconds: 10,
    productSyncIntervalHours: 6,
  },
  runFullProductSync: vi.fn(),
  runMappingConflictCheck: vi.fn(),
  recordHistoryRun: vi.fn(),
  sendSchedulerNotifications: vi.fn(),
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

vi.mock('../../history-store', () => ({
  recordHistoryRun: mockState.recordHistoryRun,
}));

vi.mock('../../scheduler-notifications', () => ({
  sendSchedulerNotifications: mockState.sendSchedulerNotifications,
  summarizeSchedulerCycle: vi.fn(({ cycleType, startedAt, finishedAt, steps }) => ({
    cycleType,
    status: steps.every((step: { status: string }) => step.status === 'success')
      ? 'success'
      : steps.every((step: { status: string }) => step.status === 'failure')
        ? 'failure'
        : 'partial',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    steps,
  })),
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
  await Promise.resolve();
  await Promise.resolve();
}

describe('scheduler startup lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockState.runFullProductSync.mockReset();
    mockState.runFullProductSync.mockResolvedValue({
      status: 'ok',
      summary: {
        units: { created: 0, linked: 0, skipped: 0 },
        products: { created: 0, linked: 0, skipped: 0, backfilled: 0 },
      },
    });
    mockState.runMappingConflictCheck.mockReset();
    mockState.runMappingConflictCheck.mockResolvedValue({
      conflicts: [],
      openedConflicts: [],
      resolvedConflicts: [],
      summary: {
        detected: 0,
        opened: 0,
        resolved: 0,
        open: 0,
      },
    });
    mockState.recordHistoryRun.mockReset();
    mockState.recordHistoryRun.mockResolvedValue(null);
    mockState.pollGrocyForMissingStock.mockReset();
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'ok',
      inPossessionStatus: 'ok',
      inPossessionSummary: {
        processedProducts: 0,
        updatedProducts: 0,
        enabledProducts: 0,
        disabledProducts: 0,
        unchangedProducts: 0,
        failedProducts: 0,
      },
      summary: {
        processedProducts: 0,
        ensuredProducts: 0,
        unmappedProducts: 0,
      },
    });
    mockState.pollMealieForCheckedItems.mockReset();
    mockState.pollMealieForCheckedItems.mockResolvedValue({
      status: 'ok',
      summary: {
        checkedItems: 0,
        restockedProducts: 0,
        failedItems: 0,
      },
    });
    mockState.sendSchedulerNotifications.mockReset();
    mockState.sendSchedulerNotifications.mockResolvedValue(undefined);
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
    expect(mockState.sendSchedulerNotifications).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await flushAsyncWork();

    expect(mockState.pollMealieForCheckedItems).toHaveBeenCalledTimes(1);
    expect(mockState.pollGrocyForMissingStock).toHaveBeenCalledTimes(1);
    expect(mockState.runMappingConflictCheck).toHaveBeenCalledTimes(2);
    expect(mockState.sendSchedulerNotifications).toHaveBeenCalledTimes(2);
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
