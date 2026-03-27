import { NextResponse } from 'next/server';
import { ensureGrocyMissingStockOnMealie } from '@/lib/sync/grocy-to-mealie';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';
import { buildGrocyToMealieHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

function formatEnsureSummaryMessage(ensuredProducts: number, unmappedProducts: number): string {
  const ensuredLabel = `${ensuredProducts} low-stock product${ensuredProducts === 1 ? '' : 's'}`;

  if (unmappedProducts === 0) {
    return `Ensured ${ensuredLabel} in Mealie.`;
  }

  const skippedLabel = `${unmappedProducts} product${unmappedProducts === 1 ? '' : 's'}`;
  const skippedReason = unmappedProducts === 1
    ? 'because it is not mapped'
    : 'because they are not mapped';

  return `Ensured ${ensuredLabel} in Mealie. Skipped ${skippedLabel} ${skippedReason}.`;
}

function formatEnsurePartialMessage(
  ensuredProducts: number,
  unmappedProducts: number,
  inPossessionStatus: 'ok' | 'skipped' | 'error' | undefined,
): string {
  const details: string[] = [formatEnsureSummaryMessage(ensuredProducts, unmappedProducts)];

  if (inPossessionStatus === 'error') {
    details.push('The "In possession" sync failed.');
  }

  return details.join(' ');
}

export async function POST(request: Request) {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'ensure_low_stock',
      status: 'skipped',
      message: 'A sync is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'ensure-low-stock',
          message: 'Ensure low-stock sync skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record ensure low-stock skip:', error));

    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 },
    );
  }

  try {
    const uiTriggered = request.headers.get('x-sync-trigger') === 'ui';
    const result = await ensureGrocyMissingStockOnMealie({
      logUnmappedPresenceCheckProducts: uiTriggered,
    });
    const historyOutcome = buildGrocyToMealieHistoryOutcome('ensure_low_stock', result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'ensure_low_stock',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record ensure low-stock sync:', error));

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'An internal error occurred during Grocy-to-Mealie ensure sync' },
        { status: 500 },
      );
    }

    if (result.status === 'skipped' && result.reason === 'no-shopping-list') {
      return NextResponse.json({
        status: 'skipped',
        message: 'No shopping list is configured, so no low-stock products were ensured in Mealie.',
        summary: result.summary,
      });
    }

    const responseStatus = result.status === 'partial' || result.summary.unmappedProducts > 0
      ? 'partial'
      : 'ok';
    return NextResponse.json({
      status: responseStatus,
      message: responseStatus === 'partial'
        ? formatEnsurePartialMessage(
          result.summary.ensuredProducts,
          result.summary.unmappedProducts,
          result.inPossessionStatus,
        )
        : formatEnsureSummaryMessage(
        result.summary.ensuredProducts,
        result.summary.unmappedProducts,
        ),
      summary: result.summary,
    });
  } catch (error) {
    log.error('[API] Grocy→Mealie ensure failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'ensure_low_stock',
      status: 'failure',
      message: 'An internal error occurred during the ensure low-stock sync.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'ensure-low-stock',
          message: 'Ensure low-stock sync failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record ensure low-stock failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during Grocy-to-Mealie ensure sync' },
      { status: 500 },
    );
  } finally {
    releaseSyncLock();
  }
}
