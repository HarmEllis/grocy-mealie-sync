import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  recordHistoryRun,
  info,
  warn,
  error,
} = vi.hoisted(() => ({
  recordHistoryRun: vi.fn(async () => undefined),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/history-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/history-store')>('@/lib/history-store');

  return {
    ...actual,
    recordHistoryRun,
  };
});

vi.mock('@/lib/logger', () => ({
  log: {
    info,
    warn,
    error,
  },
}));

import {
  buildManualHistoryEvent,
  createManualHistoryRecorder,
  formatManualActionError,
} from '@/lib/manual-action-history';

describe('manual action history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordHistoryRun.mockResolvedValue(undefined);
  });

  it('formats errors and falls back to string coercion for other values', () => {
    expect(formatManualActionError(new Error('Grocy is unavailable.'))).toBe('Grocy is unavailable.');
    expect(formatManualActionError(404)).toBe('404');
  });

  it('builds history events with null defaults for missing entity fields', () => {
    expect(buildManualHistoryEvent({
      level: 'info',
      category: 'system',
      message: 'Updated settings.',
    })).toEqual({
      level: 'info',
      category: 'system',
      entityKind: null,
      entityRef: null,
      message: 'Updated settings.',
      details: undefined,
    });
  });

  it('records warning outcomes with their log level and metadata', async () => {
    const history = createManualHistoryRecorder(
      'mapping_product_create',
      '[History] Failed to record product creation:',
    );
    const duplicateError = new Error('Duplicate already exists.');

    await history.recordOutcome({
      status: 'skipped',
      logLevel: 'warn',
      logMessage: '[Wizard] Product already existed.',
      error: duplicateError,
      message: 'Skipped product creation because the product already exists.',
      summary: { name: 'Milk' },
      events: [
        buildManualHistoryEvent({
          level: 'warning',
          category: 'product',
          entityKind: 'product',
          entityRef: 'Milk',
          message: 'Product creation skipped.',
        }),
      ],
    });

    expect(warn).toHaveBeenCalledWith('[Wizard] Product already existed.', duplicateError);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'mapping_product_create',
      status: 'skipped',
      message: 'Skipped product creation because the product already exists.',
      summary: { name: 'Milk' },
      events: [
        expect.objectContaining({
          level: 'warning',
          category: 'product',
          entityKind: 'product',
          entityRef: 'Milk',
        }),
      ],
    }));
  });

  it('records failures with the default failure status and error logging', async () => {
    const history = createManualHistoryRecorder(
      'settings_update',
      '[History] Failed to record settings update:',
    );
    const saveError = new Error('Disk full.');

    await history.recordFailure({
      logMessage: '[Settings] Save failed:',
      error: saveError,
      message: 'Saving settings failed: Disk full.',
      summary: { field: 'autoCreateProducts' },
    });

    expect(error).toHaveBeenCalledWith('[Settings] Save failed:', saveError);
    expect(recordHistoryRun).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'manual',
      action: 'settings_update',
      status: 'failure',
      message: 'Saving settings failed: Disk full.',
      summary: { field: 'autoCreateProducts' },
    }));
  });

  it('swallows history write failures after logging them', async () => {
    const history = createManualHistoryRecorder(
      'mapping_unit_sync',
      '[History] Failed to record unit mapping:',
    );
    const historyWriteError = new Error('SQLite is locked.');
    recordHistoryRun.mockRejectedValueOnce(historyWriteError);

    await expect(history.recordSuccess({
      logMessage: '[Wizard] Synced 1 unit.',
      message: 'Synced 1 unit.',
    })).resolves.toBeUndefined();

    expect(info).toHaveBeenCalledWith('[Wizard] Synced 1 unit.');
    expect(error).toHaveBeenCalledWith('[History] Failed to record unit mapping:', historyWriteError);
  });
});
