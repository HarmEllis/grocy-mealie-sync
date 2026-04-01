import { describe, expect, it, vi } from 'vitest';
import { runShoppingCleanup, type ShoppingCleanupDeps } from '../shopping-cleanup';
import { mockSyncState } from './helpers/mocks';

function createMockDeps(overrides: Partial<ShoppingCleanupDeps> = {}): ShoppingCleanupDeps {
  return {
    resolveAfterHours: vi.fn().mockResolvedValue(24),
    resolveMode: vi.fn().mockResolvedValue('all'),
    resolveShoppingListId: vi.fn().mockResolvedValue('list-1'),
    fetchShoppingItems: vi.fn().mockResolvedValue([]),
    deleteShoppingItem: vi.fn().mockResolvedValue(undefined),
    getSyncState: vi.fn().mockResolvedValue(mockSyncState()),
    saveSyncState: vi.fn().mockResolvedValue(undefined),
    now: () => new Date('2026-03-25T12:00:00.000Z'),
    ...overrides,
  };
}

function mockItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    checked: true,
    foodId: null,
    note: '',
    display: '',
    quantity: 1,
    ...overrides,
  };
}

describe('runShoppingCleanup', () => {
  it('returns skipped when cleanup is disabled (afterHours = -1)', async () => {
    const deps = createMockDeps({ resolveAfterHours: vi.fn().mockResolvedValue(-1) });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('disabled');
    expect(deps.fetchShoppingItems).not.toHaveBeenCalled();
  });

  it('returns skipped when no shopping list is configured', async () => {
    const deps = createMockDeps({ resolveShoppingListId: vi.fn().mockResolvedValue(null) });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no-shopping-list');
  });

  it('returns skipped when already ran today', async () => {
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(mockSyncState({
        lastCleanupRun: '2026-03-25T06:00:00.000Z',
      })),
    });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('already-ran-today');
    expect(deps.fetchShoppingItems).not.toHaveBeenCalled();
  });

  it('runs when already ran today if skipDailyCheck is true', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'item-1': true },
      mealieCheckedAt: { 'item-1': '2026-03-24T10:00:00.000Z' },
      lastCleanupRun: '2026-03-25T06:00:00.000Z',
    });
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([mockItem('item-1')]),
    });

    const result = await runShoppingCleanup(deps, { skipDailyCheck: true });

    expect(result.status).toBe('ok');
    expect(result.summary.removedItems).toBe(1);
    expect(deps.fetchShoppingItems).toHaveBeenCalled();
  });

  it('removes items checked longer than the configured threshold', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'item-1': true },
      mealieCheckedAt: { 'item-1': '2026-03-24T10:00:00.000Z' }, // 26 hours ago
    });
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([mockItem('item-1')]),
    });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('ok');
    expect(result.summary.eligibleItems).toBe(1);
    expect(result.summary.removedItems).toBe(1);
    expect(deps.deleteShoppingItem).toHaveBeenCalledWith('item-1');
  });

  it('does not remove items checked less than the configured threshold', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'item-1': true },
      mealieCheckedAt: { 'item-1': '2026-03-25T10:00:00.000Z' }, // 2 hours ago
    });
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([mockItem('item-1')]),
    });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('ok');
    expect(result.summary.eligibleItems).toBe(0);
    expect(result.summary.removedItems).toBe(0);
    expect(deps.deleteShoppingItem).not.toHaveBeenCalled();
  });

  it('in synced_only mode, only removes items that exist in mealieItemsSyncedToGrocy', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'synced-item': true, 'unsynced-item': true },
      mealieCheckedAt: {
        'synced-item': '2026-03-24T00:00:00.000Z',
        'unsynced-item': '2026-03-24T00:00:00.000Z',
      },
      mealieItemsSyncedToGrocy: { 'synced-item': '2026-03-24T00:01:00.000Z' },
    });
    const deps = createMockDeps({
      resolveMode: vi.fn().mockResolvedValue('synced_only'),
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([
        mockItem('synced-item'),
        mockItem('unsynced-item'),
      ]),
    });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('ok');
    expect(result.summary.eligibleItems).toBe(2);
    expect(result.summary.removedItems).toBe(1);
    expect(result.summary.skippedItems).toBe(1);
    expect(deps.deleteShoppingItem).toHaveBeenCalledWith('synced-item');
    expect(deps.deleteShoppingItem).not.toHaveBeenCalledWith('unsynced-item');
  });

  it('in all mode, removes all checked items past the threshold regardless of sync status', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'item-a': true, 'item-b': true },
      mealieCheckedAt: {
        'item-a': '2026-03-24T00:00:00.000Z',
        'item-b': '2026-03-24T00:00:00.000Z',
      },
      // item-b is NOT in mealieItemsSyncedToGrocy
      mealieItemsSyncedToGrocy: { 'item-a': '2026-03-24T00:01:00.000Z' },
    });
    const deps = createMockDeps({
      resolveMode: vi.fn().mockResolvedValue('all'),
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([
        mockItem('item-a'),
        mockItem('item-b'),
      ]),
    });

    const result = await runShoppingCleanup(deps);

    expect(result.summary.removedItems).toBe(2);
    expect(result.summary.skippedItems).toBe(0);
    expect(deps.deleteShoppingItem).toHaveBeenCalledWith('item-a');
    expect(deps.deleteShoppingItem).toHaveBeenCalledWith('item-b');
  });

  it('cleans up state maps for removed items', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'item-1': true },
      mealieCheckedAt: { 'item-1': '2026-03-24T00:00:00.000Z' },
      mealieItemsSyncedToGrocy: { 'item-1': '2026-03-24T00:01:00.000Z' },
    });
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([mockItem('item-1')]),
    });

    await runShoppingCleanup(deps);

    const savedState = (deps.saveSyncState as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedState.mealieCheckedItems).not.toHaveProperty('item-1');
    expect(savedState.mealieCheckedAt).not.toHaveProperty('item-1');
    expect(savedState.mealieItemsSyncedToGrocy).not.toHaveProperty('item-1');
  });

  it('returns partial when some deletions fail', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'ok-item': true, 'fail-item': true },
      mealieCheckedAt: {
        'ok-item': '2026-03-24T00:00:00.000Z',
        'fail-item': '2026-03-24T00:00:00.000Z',
      },
    });
    const deleteShoppingItem = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('API error'));
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([
        mockItem('ok-item'),
        mockItem('fail-item'),
      ]),
      deleteShoppingItem,
    });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('partial');
    expect(result.summary.removedItems).toBe(1);
    expect(result.summary.failedItems).toBe(1);
  });

  it('returns error when all deletions fail', async () => {
    const state = mockSyncState({
      mealieCheckedItems: { 'fail-item': true },
      mealieCheckedAt: { 'fail-item': '2026-03-24T00:00:00.000Z' },
    });
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([mockItem('fail-item')]),
      deleteShoppingItem: vi.fn().mockRejectedValue(new Error('API error')),
    });

    const result = await runShoppingCleanup(deps);

    expect(result.status).toBe('error');
    expect(result.summary.failedItems).toBe(1);
    expect(result.summary.removedItems).toBe(0);
  });

  it('updates lastCleanupRun timestamp after successful run', async () => {
    const deps = createMockDeps();

    await runShoppingCleanup(deps);

    const savedState = (deps.saveSyncState as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedState.lastCleanupRun).toBe('2026-03-25T12:00:00.000Z');
  });

  it('removes stale entries from mealieCheckedAt that no longer exist in the Mealie list', async () => {
    const state = mockSyncState({
      mealieCheckedAt: {
        'exists': '2026-03-25T11:00:00.000Z', // Recent — under threshold
        'gone': '2026-03-24T00:00:00.000Z',   // No longer on list
      },
      mealieItemsSyncedToGrocy: {
        'gone': '2026-03-24T00:01:00.000Z',
      },
    });
    const deps = createMockDeps({
      getSyncState: vi.fn().mockResolvedValue(state),
      fetchShoppingItems: vi.fn().mockResolvedValue([mockItem('exists')]),
    });

    await runShoppingCleanup(deps);

    const savedState = (deps.saveSyncState as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedState.mealieCheckedAt).toHaveProperty('exists');
    expect(savedState.mealieCheckedAt).not.toHaveProperty('gone');
    expect(savedState.mealieItemsSyncedToGrocy).not.toHaveProperty('gone');
  });
});
