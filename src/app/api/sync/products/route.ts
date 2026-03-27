import { NextResponse } from 'next/server';
import { runFullProductSync } from '@/lib/sync/product-sync';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';
import { buildProductSyncHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

export async function POST() {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'product_sync',
      status: 'skipped',
      message: 'A sync is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'product-sync',
          message: 'Product sync skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record product sync skip:', error));

    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }
  try {
    const result = await runFullProductSync();
    const historyOutcome = buildProductSyncHistoryOutcome(result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'product_sync',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record product sync:', error));

    return NextResponse.json({
      status: 'ok',
      message: historyOutcome.message,
      summary: result.summary,
    });
  } catch (error) {
    log.error('[API] Product sync failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'product_sync',
      status: 'failure',
      message: 'An internal error occurred during product sync.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'product-sync',
          message: 'Product sync failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record product sync failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during product sync' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
