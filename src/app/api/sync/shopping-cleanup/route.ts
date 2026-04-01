import { NextResponse } from 'next/server';
import { runShoppingCleanup } from '@/lib/sync/shopping-cleanup';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';
import { buildShoppingCleanupHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

export async function POST() {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'shopping_cleanup',
      status: 'skipped',
      message: 'A sync is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'shopping-cleanup',
          message: 'Shopping list cleanup skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record shopping cleanup skip:', error));

    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }

  try {
    const result = await runShoppingCleanup(undefined, { skipDailyCheck: true });
    const historyOutcome = buildShoppingCleanupHistoryOutcome(result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'shopping_cleanup',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record shopping cleanup:', error));

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'An internal error occurred during shopping list cleanup' },
        { status: 500 },
      );
    }

    if (result.status === 'skipped') {
      return NextResponse.json({
        status: 'skipped',
        message: `Shopping list cleanup skipped: ${result.reason ?? 'unknown'}.`,
        summary: result.summary,
      });
    }

    if (result.status === 'partial') {
      return NextResponse.json({
        status: 'partial',
        message: `Shopping list cleanup partially completed. Eligible ${result.summary.eligibleItems} item(s); removed ${result.summary.removedItems}; skipped ${result.summary.skippedItems}; failed ${result.summary.failedItems}.`,
        summary: result.summary,
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: `Shopping list cleanup completed. Removed ${result.summary.removedItems} item(s).`,
      summary: result.summary,
    });
  } catch (error) {
    log.error('[API] Shopping cleanup failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'shopping_cleanup',
      status: 'failure',
      message: 'An internal error occurred during shopping list cleanup.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'shopping-cleanup',
          message: 'Shopping list cleanup failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record shopping cleanup failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during shopping list cleanup' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
