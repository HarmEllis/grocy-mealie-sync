import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    pollIntervalSeconds: 10,
    productSyncIntervalHours: 6,
    historyRetentionDays: 7,
  },
  runFullProductSync: vi.fn(),
  runShoppingCleanup: vi.fn(),
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

vi.mock('../shopping-cleanup', () => ({
  runShoppingCleanup: mockState.runShoppingCleanup,
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

vi.mock('../../shop/worker', () => ({
  isShopFeatureActive: vi.fn(() => false),
  runShopDemandStep: vi.fn(),
  runShopReconcileStep: vi.fn(),
  startShopWorker: vi.fn(),
  stopShopWorker: vi.fn(),
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

import { getSchedulerRuntimeState, startScheduler, stopScheduler } from '../scheduler';

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('scheduler startup lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockState.config.pollIntervalSeconds = 10;
    mockState.config.productSyncIntervalHours = 6;
    mockState.config.historyRetentionDays = 7;
    mockState.runFullProductSync.mockReset();
    mockState.runFullProductSync.mockResolvedValue({
      status: 'ok',
      summary: {
        units: { created: 0, linked: 0, skipped: 0 },
        products: { created: 0, linked: 0, skipped: 0, backfilled: 0 },
      },
    });
    mockState.runShoppingCleanup.mockReset();
    mockState.runShoppingCleanup.mockResolvedValue({
      status: 'skipped', reason: 'disabled',
      summary: { eligibleItems: 0, removedItems: 0, skippedItems: 0, failedItems: 0 },
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

    expect(getSchedulerRuntimeState().status).toBe('active');

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

    expect(getSchedulerRuntimeState().status).toBe('passive_startup_lock');

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
    expect(getSchedulerRuntimeState().status).toBe('inactive');
  });

  it('marks scheduler notifications as partial when the conflict check leaves conflicts open', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    mockState.runMappingConflictCheck.mockResolvedValue({
      conflicts: [
        {
          id: 'conflict-1',
          conflictKey: 'missing_grocy_product:product:product-map-1',
          type: 'missing_grocy_product',
          status: 'open',
          severity: 'error',
          mappingKind: 'product',
          mappingId: 'product-map-1',
          sourceTab: 'products',
          mealieId: 'food-1',
          mealieName: 'Milk',
          grocyId: 101,
          grocyName: 'Milk',
          summary: 'Mapped Grocy product "Milk" no longer exists.',
          occurrences: 1,
          firstSeenAt: new Date('2026-03-28T10:00:00.000Z'),
          lastSeenAt: new Date('2026-03-28T10:05:00.000Z'),
          resolvedAt: null,
        },
      ],
      openedConflicts: [],
      resolvedConflicts: [],
      summary: {
        detected: 1,
        opened: 0,
        resolved: 0,
        open: 1,
      },
    });

    startScheduler();
    await flushAsyncWork();

    expect(mockState.sendSchedulerNotifications).toHaveBeenCalledWith(expect.objectContaining({
      cycleType: 'initial',
      status: 'partial',
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: 'conflict_check',
          status: 'partial',
        }),
      ]),
    }));
    expect(mockState.recordHistoryRun).not.toHaveBeenCalled();
  });

  it('does not store quiet cycles and stores concrete sync mutations', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    startScheduler();
    await flushAsyncWork();
    expect(mockState.recordHistoryRun).not.toHaveBeenCalled();
    mockState.pollMealieForCheckedItems.mockResolvedValue({
      status: 'ok', summary: { checkedItems: 1, restockedProducts: 1, failedItems: 0 },
      events: [{ kind: 'mutation', level: 'info', category: 'inventory', productName: 'Milk', source: 'Mealie', target: 'Grocy', message: 'Added 2 to Grocy stock for Milk.' }],
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await flushAsyncWork();
    expect(mockState.recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'scheduler', events: expect.arrayContaining([expect.objectContaining({
        kind: 'mutation', productName: 'Milk', message: 'Added 2 to Grocy stock for Milk.',
      })]),
    }));
  });

  it('stores a persistent product error once while retaining subsequent mutations', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    const issue = {
      kind: 'issue', level: 'error', category: 'sync', entityRef: 'grocy:101', productName: 'Milk',
      message: 'Could not sync In possession for Milk.', reason: 'The mapped Grocy product no longer exists.',
    };
    const failure = {
      status: 'partial', summary: { processedProducts: 0, ensuredProducts: 0, unmappedProducts: 0 }, events: [issue],
    };
    mockState.pollGrocyForMissingStock.mockResolvedValue(failure);
    startScheduler();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(1);
    expect(mockState.sendSchedulerNotifications).toHaveBeenCalledTimes(3);

    mockState.pollGrocyForMissingStock.mockResolvedValue({
      ...failure,
      events: [{ ...issue, createdAt: new Date() }, {
        kind: 'mutation', level: 'info', category: 'shopping', productName: 'Rice', message: 'Added Rice to Mealie.',
      }],
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(2);
    const lastRun = mockState.recordHistoryRun.mock.lastCall?.[0];
    expect(lastRun.events.filter((event: { kind: string }) => event.kind !== 'diagnostic')).toEqual([
      expect.objectContaining({ kind: 'mutation', productName: 'Rice' }),
    ]);
  });

  it('reports a checked-item error again after recovery and when its cause changes', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    const issue = {
      kind: 'issue', level: 'error', category: 'inventory', entityRef: 'item-1', productName: 'Milk',
      message: 'Could not process checked Mealie item: timeout', details: { error: 'timeout' },
    };
    const failure = {
      status: 'partial', summary: { checkedItems: 1, restockedProducts: 0, failedItems: 1 }, events: [issue],
    };
    mockState.pollMealieForCheckedItems.mockResolvedValue(failure);
    startScheduler();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(1);

    mockState.pollMealieForCheckedItems.mockResolvedValue({
      status: 'ok', summary: { checkedItems: 0, restockedProducts: 0, failedItems: 0 }, events: [],
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(1);
    mockState.pollMealieForCheckedItems.mockResolvedValue(failure);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(2);
    mockState.pollMealieForCheckedItems.mockResolvedValue({
      ...failure, events: [{ ...issue, message: 'Could not process checked Mealie item: unauthorized', details: { error: 'unauthorized' } }],
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(3);
  });

  it('retries storing an issue when the previous history write failed', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    mockState.pollMealieForCheckedItems.mockRejectedValue(new Error('Mealie unavailable'));
    mockState.recordHistoryRun.mockRejectedValueOnce(new Error('History write failed'));
    startScheduler();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(2);
  });

  it('reports changed step failures even when a previous cause returns', async () => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    mockState.pollMealieForCheckedItems.mockRejectedValue(new Error('timeout'));
    startScheduler();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(10_000);
    mockState.pollMealieForCheckedItems.mockRejectedValue(new Error('unauthorized'));
    await vi.advanceTimersByTimeAsync(10_000);
    mockState.pollMealieForCheckedItems.mockRejectedValue(new Error('timeout'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(3);
  });

  it.each(['failure', 'partial'] as const)('retains known product errors through an aborted %s check', async status => {
    mockState.acquireSchedulerLock.mockReturnValue(true);
    mockState.pollGrocyForMissingStock.mockResolvedValue({
      status: 'partial', summary: { processedProducts: 0, ensuredProducts: 0, unmappedProducts: 0 },
      events: [{ kind: 'issue', level: 'error', category: 'sync', entityRef: 'grocy:101', productName: 'Milk', message: 'Mapped Grocy product is missing.' }],
    });
    startScheduler();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(10_000);
    if (status === 'failure') {
      mockState.pollGrocyForMissingStock.mockRejectedValueOnce(new Error('Grocy unavailable'));
    } else {
      mockState.pollGrocyForMissingStock.mockResolvedValueOnce({
        status: 'partial', summary: { processedProducts: 1, ensuredProducts: 1, unmappedProducts: 0 },
        events: [
          { kind: 'mutation', level: 'info', category: 'shopping', productName: 'Rice', message: 'Added Rice to Mealie.' },
          { kind: 'issue', level: 'error', category: 'sync', message: 'Grocy sync failed before products could be checked.' },
        ],
      });
    }
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(2);
  });

  it.each([[7, 24], [1, 12]])('keeps ongoing errors visible with %i-day retention by reporting every %i hours', async (retentionDays, intervalHours) => {
    mockState.config.historyRetentionDays = retentionDays;
    mockState.config.pollIntervalSeconds = 3600;
    mockState.acquireSchedulerLock.mockReturnValue(true);
    mockState.pollMealieForCheckedItems.mockRejectedValue(new Error('Mealie unavailable'));
    startScheduler();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(intervalHours * 3_600_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(mockState.recordHistoryRun).toHaveBeenCalledTimes(2);
  });
});
