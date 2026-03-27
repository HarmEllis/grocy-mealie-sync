import { NextResponse } from 'next/server';
import { pollMealieForCheckedItems } from '@/lib/sync/mealie-to-grocy';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';
import { buildMealieToGrocyHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

function formatMealieToGrocyMessage(restockedProducts: number, failedItems: number): string {
  if (failedItems > 0) {
    return `Processed ${restockedProducts} checked Mealie item${restockedProducts === 1 ? '' : 's'}. Failed ${failedItems} item${failedItems === 1 ? '' : 's'}.`;
  }

  if (restockedProducts === 0) {
    return 'Mealie→Grocy check completed. No new checked items were processed.';
  }

  return `Processed ${restockedProducts} checked Mealie item${restockedProducts === 1 ? '' : 's'}.`;
}

export async function POST() {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'mealie_to_grocy',
      status: 'skipped',
      message: 'A sync is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'mealie-to-grocy',
          message: 'Mealie to Grocy sync skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record Mealie to Grocy skip:', error));

    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }
  try {
    const result = await pollMealieForCheckedItems();
    const historyOutcome = buildMealieToGrocyHistoryOutcome(result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'mealie_to_grocy',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record Mealie to Grocy sync:', error));

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'An internal error occurred during Mealie-to-Grocy sync' },
        { status: 500 },
      );
    }

    if (result.status === 'skipped' && result.reason === 'no-shopping-list') {
      return NextResponse.json({
        status: 'skipped',
        message: 'No shopping list is configured, so the Mealie-to-Grocy check was skipped.',
        summary: result.summary,
      });
    }

    return NextResponse.json({
      status: result.status,
      message: formatMealieToGrocyMessage(
        result.summary.restockedProducts,
        result.summary.failedItems,
      ),
      summary: result.summary,
    });
  } catch (error) {
    log.error('[API] Mealie→Grocy sync failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'mealie_to_grocy',
      status: 'failure',
      message: 'An internal error occurred during Mealie to Grocy sync.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'mealie-to-grocy',
          message: 'Mealie to Grocy sync failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record Mealie to Grocy failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during Mealie-to-Grocy sync' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
