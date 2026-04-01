import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it, vi } from 'vitest';

type HistoryConfig = {
  historyEnabled: boolean;
  historyRetentionDays: number | null;
};

async function loadHistoryStore(sqlite: Database.Database, config: HistoryConfig) {
  vi.resetModules();
  const testDb = drizzle(sqlite);

  migrate(testDb, { migrationsFolder: path.resolve('drizzle') });

  vi.doMock('../db', () => ({
    db: testDb,
  }));

  vi.doMock('../config', () => ({
    config,
  }));

  return import('../history-store');
}

describe('history store', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('records runs and their detail events', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await historyStore.initializeHistoryStorage();

      const runId = await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'success',
        message: 'Product sync completed.',
        startedAt: new Date('2026-03-27T10:00:00.000Z'),
        finishedAt: new Date('2026-03-27T10:00:30.000Z'),
        summary: {
          units: { created: 1, linked: 2, skipped: 3 },
          products: { created: 4, linked: 5, skipped: 6, backfilled: 7 },
        },
        events: [
          {
            level: 'info',
            category: 'sync',
            entityKind: 'unit',
            entityRef: 'unit-sync',
            message: 'Units synced.',
            details: { created: 1, linked: 2, skipped: 3 },
          },
          {
            level: 'info',
            category: 'sync',
            entityKind: 'product',
            entityRef: 'product-sync',
            message: 'Products synced.',
            details: { created: 4, linked: 5, skipped: 6, backfilled: 7 },
          },
        ],
      });

      expect(runId).not.toBeNull();

      const runs = await historyStore.listHistoryRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0]).toEqual(
        expect.objectContaining({
          id: runId,
          trigger: 'manual',
          action: 'product_sync',
          status: 'success',
          message: 'Product sync completed.',
          summary: {
            units: { created: 1, linked: 2, skipped: 3 },
            products: { created: 4, linked: 5, skipped: 6, backfilled: 7 },
          },
          eventCount: 2,
        }),
      );

      const details = await historyStore.getHistoryRunDetails(runId!);
      expect(details).toEqual(
        expect.objectContaining({
          run: expect.objectContaining({
            id: runId,
            action: 'product_sync',
          }),
          events: expect.arrayContaining([
            expect.objectContaining({
              category: 'sync',
              entityKind: 'unit',
              message: 'Units synced.',
              details: { created: 1, linked: 2, skipped: 3 },
            }),
            expect.objectContaining({
              category: 'sync',
              entityKind: 'product',
              message: 'Products synced.',
              details: { created: 4, linked: 5, skipped: 6, backfilled: 7 },
            }),
          ]),
        }),
      );
    } finally {
      sqlite.close();
    }
  });

  it('prunes history older than the configured retention window', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await historyStore.initializeHistoryStorage();

      await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'success',
        startedAt: new Date('2026-03-10T09:00:00.000Z'),
        finishedAt: new Date('2026-03-10T09:05:00.000Z'),
        summary: { kind: 'old' },
        events: [{ level: 'info', category: 'sync', message: 'Old run.' }],
        now: new Date('2026-03-20T00:00:00.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'success',
        startedAt: new Date('2026-03-19T09:00:00.000Z'),
        finishedAt: new Date('2026-03-19T09:05:00.000Z'),
        summary: { kind: 'recent' },
        events: [{ level: 'info', category: 'sync', message: 'Recent run.' }],
        now: new Date('2026-03-20T00:00:00.000Z'),
      });

      const runs = await historyStore.listHistoryRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0]?.summary).toEqual({ kind: 'recent' });
    } finally {
      sqlite.close();
    }
  });

  it('lists history runs from newest completion to oldest', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await historyStore.initializeHistoryStorage();

      const slowerRunId = await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'success',
        message: 'Longer run completed later.',
        startedAt: new Date('2026-03-28T10:00:00.000Z'),
        finishedAt: new Date('2026-03-28T10:05:00.000Z'),
        events: [{ level: 'info', category: 'sync', message: 'Longer run.' }],
      });

      const quickerRunId = await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'success',
        message: 'Quicker run started later but finished earlier.',
        startedAt: new Date('2026-03-28T10:01:00.000Z'),
        finishedAt: new Date('2026-03-28T10:02:00.000Z'),
        events: [{ level: 'info', category: 'sync', message: 'Quicker run.' }],
      });

      const runs = await historyStore.listHistoryRuns();

      expect(runs.map(run => run.id)).toEqual([slowerRunId, quickerRunId]);
    } finally {
      sqlite.close();
    }
  });

  it('clears stored history when the feature is disabled', async () => {
    const sqlite = new Database(':memory:');

    try {
      const enabledStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await enabledStore.initializeHistoryStorage();
      await enabledStore.recordHistoryRun({
        trigger: 'manual',
        action: 'clear_sync_locks',
        status: 'success',
        startedAt: new Date('2026-03-27T11:00:00.000Z'),
        finishedAt: new Date('2026-03-27T11:00:05.000Z'),
        events: [{ level: 'info', category: 'lock', message: 'Locks cleared.' }],
      });

      const disabledStore = await loadHistoryStore(sqlite, {
        historyEnabled: false,
        historyRetentionDays: null,
      });

      await disabledStore.initializeHistoryStorage();

      expect(await disabledStore.listHistoryRuns()).toEqual([]);
      expect(await disabledStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'success',
        startedAt: new Date('2026-03-27T12:00:00.000Z'),
        finishedAt: new Date('2026-03-27T12:00:05.000Z'),
      })).toBeNull();
      expect(await disabledStore.listHistoryRuns()).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('reads from migrated history tables without bootstrapping storage on read', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await expect(historyStore.listHistoryRuns()).resolves.toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('shows scheduler step marker events after detailed step events with the same timestamp', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await historyStore.initializeHistoryStorage();

      const runId = await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        startedAt: new Date('2026-03-28T08:00:00.000Z'),
        finishedAt: new Date('2026-03-28T08:00:30.000Z'),
        events: [
          {
            level: 'info',
            category: 'sync',
            entityRef: 'grocy_to_mealie',
            message: 'Grocy to Mealie step success.',
          },
          {
            level: 'info',
            category: 'sync',
            entityKind: 'shopping_item',
            entityRef: 'grocy_to_mealie',
            message: 'Grocy to Mealie: Grocy to Mealie sync completed.',
          },
        ],
      });

      const details = await historyStore.getHistoryRunDetails(runId!);
      expect(details?.events.map(event => event.message)).toEqual([
        'Grocy to Mealie: Grocy to Mealie sync completed.',
        'Grocy to Mealie step success.',
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('filters runs by search term, action, and trigger', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await historyStore.initializeHistoryStorage();

      await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'settings_update',
        status: 'success',
        message: 'Updated stock settings.',
        startedAt: new Date('2026-03-28T09:00:00.000Z'),
        finishedAt: new Date('2026-03-28T09:00:05.000Z'),
        events: [
          {
            level: 'info',
            category: 'system',
            message: 'Disabled stock-only min stock mode.',
          },
        ],
      });

      await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'conflict_remap',
        status: 'success',
        message: 'Resolved duplicate product conflict.',
        startedAt: new Date('2026-03-28T10:00:00.000Z'),
        finishedAt: new Date('2026-03-28T10:00:06.000Z'),
        events: [
          {
            level: 'info',
            category: 'conflict',
            message: 'Updated conflict mapping selection.',
          },
        ],
      });

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        message: 'Scheduler cycle completed.',
        startedAt: new Date('2026-03-28T11:00:00.000Z'),
        finishedAt: new Date('2026-03-28T11:00:30.000Z'),
        events: [
          {
            level: 'info',
            category: 'sync',
            message: 'Conflict check step success.',
          },
        ],
      });

      await expect(historyStore.listHistoryRuns(100, { search: 'duplicate' })).resolves.toEqual([
        expect.objectContaining({
          action: 'conflict_remap',
        }),
      ]);

      await expect(historyStore.listHistoryRuns(100, { action: 'settings_update' })).resolves.toEqual([
        expect.objectContaining({
          action: 'settings_update',
        }),
      ]);

      await expect(historyStore.listHistoryRuns(100, { trigger: 'scheduler' })).resolves.toEqual([
        expect.objectContaining({
          action: 'scheduler_cycle',
          trigger: 'scheduler',
        }),
      ]);

      await expect(historyStore.listHistoryRuns(100, {
        search: 'updated',
        action: 'settings_update',
        trigger: 'manual',
      })).resolves.toEqual([
        expect.objectContaining({
          action: 'settings_update',
          trigger: 'manual',
        }),
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('filters runs by status', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await historyStore.initializeHistoryStorage();

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        startedAt: new Date('2026-03-28T10:00:00.000Z'),
        finishedAt: new Date('2026-03-28T10:00:30.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'failure',
        message: 'Sync failed.',
        startedAt: new Date('2026-03-28T11:00:00.000Z'),
        finishedAt: new Date('2026-03-28T11:00:30.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'manual',
        action: 'product_sync',
        status: 'partial',
        startedAt: new Date('2026-03-28T12:00:00.000Z'),
        finishedAt: new Date('2026-03-28T12:00:30.000Z'),
      });

      const failureRuns = await historyStore.listHistoryRuns(100, { status: 'failure' });
      expect(failureRuns).toHaveLength(1);
      expect(failureRuns[0]).toEqual(expect.objectContaining({ status: 'failure' }));

      const successRuns = await historyStore.listHistoryRuns(100, { status: 'success' });
      expect(successRuns).toHaveLength(1);
      expect(successRuns[0]).toEqual(expect.objectContaining({ status: 'success' }));

      const skippedRuns = await historyStore.listHistoryRuns(100, { status: 'skipped' });
      expect(skippedRuns).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  it('filters runs by date range', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 30,
      });

      await historyStore.initializeHistoryStorage();

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        message: 'March 20 run.',
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        finishedAt: new Date('2026-03-20T10:00:30.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        message: 'March 25 run.',
        startedAt: new Date('2026-03-25T10:00:00.000Z'),
        finishedAt: new Date('2026-03-25T10:00:30.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        message: 'March 28 run.',
        startedAt: new Date('2026-03-28T10:00:00.000Z'),
        finishedAt: new Date('2026-03-28T10:00:30.000Z'),
      });

      // dateFrom only
      const fromRuns = await historyStore.listHistoryRuns(100, {
        dateFrom: new Date('2026-03-25T00:00:00.000Z'),
      });
      expect(fromRuns).toHaveLength(2);
      expect(fromRuns.map(r => r.message)).toEqual(['March 28 run.', 'March 25 run.']);

      // dateTo only
      const toRuns = await historyStore.listHistoryRuns(100, {
        dateTo: new Date('2026-03-25T23:59:59.999Z'),
      });
      expect(toRuns).toHaveLength(2);
      expect(toRuns.map(r => r.message)).toEqual(['March 25 run.', 'March 20 run.']);

      // dateFrom + dateTo
      const rangeRuns = await historyStore.listHistoryRuns(100, {
        dateFrom: new Date('2026-03-24T00:00:00.000Z'),
        dateTo: new Date('2026-03-26T23:59:59.999Z'),
      });
      expect(rangeRuns).toHaveLength(1);
      expect(rangeRuns[0]?.message).toBe('March 25 run.');

      // No matches
      const emptyRuns = await historyStore.listHistoryRuns(100, {
        dateFrom: new Date('2026-04-01T00:00:00.000Z'),
      });
      expect(emptyRuns).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  it('combines status and date range filters', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 30,
      });

      await historyStore.initializeHistoryStorage();

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'success',
        startedAt: new Date('2026-03-25T10:00:00.000Z'),
        finishedAt: new Date('2026-03-25T10:00:30.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'failure',
        startedAt: new Date('2026-03-25T11:00:00.000Z'),
        finishedAt: new Date('2026-03-25T11:00:30.000Z'),
      });

      await historyStore.recordHistoryRun({
        trigger: 'scheduler',
        action: 'scheduler_cycle',
        status: 'failure',
        startedAt: new Date('2026-03-28T10:00:00.000Z'),
        finishedAt: new Date('2026-03-28T10:00:30.000Z'),
      });

      const runs = await historyStore.listHistoryRuns(100, {
        status: 'failure',
        dateFrom: new Date('2026-03-25T00:00:00.000Z'),
        dateTo: new Date('2026-03-25T23:59:59.999Z'),
      });
      expect(runs).toHaveLength(1);
      expect(runs[0]).toEqual(expect.objectContaining({ status: 'failure' }));
    } finally {
      sqlite.close();
    }
  });
});
