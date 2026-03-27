import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { clearSchedulerLock, clearSyncLock } from '@/lib/sync/mutex';
import { buildClearSyncLocksHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

export async function POST() {
  const startedAt = new Date();

  try {
    const clearedSyncLock = clearSyncLock();
    const clearedSchedulerLock = clearSchedulerLock();
    const cleared = clearedSyncLock || clearedSchedulerLock;
    const historyOutcome = buildClearSyncLocksHistoryOutcome(clearedSyncLock, clearedSchedulerLock);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'clear_sync_locks',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record sync lock clear:', error));

    if (!cleared) {
      return NextResponse.json({
        status: 'skipped',
        message: 'No sync locks were present.',
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Sync locks cleared.',
    });
  } catch (error) {
    log.error('[API] Sync unlock failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'clear_sync_locks',
      status: 'failure',
      message: 'An internal error occurred while clearing sync locks.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'lock',
          entityKind: 'lock',
          entityRef: 'sync-locks',
          message: 'Clearing sync locks failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record sync lock clear failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred while clearing the sync locks' },
      { status: 500 },
    );
  }
}
