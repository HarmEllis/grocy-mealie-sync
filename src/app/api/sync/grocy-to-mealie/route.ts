import { NextResponse } from 'next/server';
import { pollGrocyForMissingStock } from '@/lib/sync/grocy-to-mealie';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';
import { buildGrocyToMealieHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

function formatUnmappedProductsMessage(unmappedProducts: number): string {
  const skippedLabel = `${unmappedProducts} low-stock product${unmappedProducts === 1 ? '' : 's'}`;
  const skippedReason = unmappedProducts === 1
    ? 'because it is not mapped.'
    : 'because they are not mapped.';

  return `Skipped ${skippedLabel} ${skippedReason}`;
}

function formatPartialMessage(result: Awaited<ReturnType<typeof pollGrocyForMissingStock>>): string {
  const details: string[] = [];

  if (result.reason === 'no-shopping-list') {
    details.push('The low-stock shopping-list sync was skipped because no shopping list is configured.');
  }

  if (result.summary.unmappedProducts > 0) {
    details.push(formatUnmappedProductsMessage(result.summary.unmappedProducts));
  }

  if (result.inPossessionStatus === 'error') {
    details.push('The "In possession" sync failed.');
  }

  if (details.length === 0) {
    return 'Grocy→Mealie check partially completed.';
  }

  return `Grocy→Mealie check partially completed. ${details.join(' ')}`;
}

export async function POST() {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'grocy_to_mealie',
      status: 'skipped',
      message: 'A sync is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'grocy-to-mealie',
          message: 'Grocy to Mealie sync skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record Grocy to Mealie skip:', error));

    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }
  try {
    const result = await pollGrocyForMissingStock();
    const historyOutcome = buildGrocyToMealieHistoryOutcome('grocy_to_mealie', result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'grocy_to_mealie',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record Grocy to Mealie sync:', error));

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'An internal error occurred during Grocy-to-Mealie sync' },
        { status: 500 },
      );
    }

    if (result.status === 'skipped' && result.reason === 'no-shopping-list') {
      return NextResponse.json({
        status: 'skipped',
        message: 'No shopping list is configured, so the low-stock shopping-list sync was skipped.',
        summary: result.summary,
      });
    }

    if (result.status === 'partial') {
      return NextResponse.json({
        status: 'partial',
        message: formatPartialMessage(result),
        summary: result.summary,
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Grocy→Mealie check completed',
      summary: result.summary,
    });
  } catch (error) {
    log.error('[API] Grocy→Mealie sync failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'grocy_to_mealie',
      status: 'failure',
      message: 'An internal error occurred during Grocy to Mealie sync.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'grocy-to-mealie',
          message: 'Grocy to Mealie sync failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record Grocy to Mealie failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during Grocy-to-Mealie sync' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
