import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

type HistoryConfig = {
  historyEnabled: boolean;
  historyRetentionDays: number | null;
};

async function loadHistoryStore(sqlite: Database.Database, config: HistoryConfig) {
  vi.resetModules();

  vi.doMock('../db', () => ({
    db: drizzle(sqlite),
    sqlite,
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

  it('bootstraps the history tables on first read', async () => {
    const sqlite = new Database(':memory:');

    try {
      const historyStore = await loadHistoryStore(sqlite, {
        historyEnabled: true,
        historyRetentionDays: 7,
      });

      await expect(historyStore.listHistoryRuns()).resolves.toEqual([]);

      const tables = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('history_runs', 'history_events') ORDER BY name",
      ).all() as Array<{ name: string }>;

      expect(tables.map(table => table.name)).toEqual(['history_events', 'history_runs']);
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
});
