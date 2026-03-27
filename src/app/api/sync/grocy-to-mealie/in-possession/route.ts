import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { reconcileMealieInPossessionFromGrocy } from '@/lib/sync/mealie-in-possession';
import { buildInPossessionHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

function formatReconcileMessage(updatedProducts: number, enabledProducts: number, disabledProducts: number): string {
  if (updatedProducts === 0) {
    return 'Reconciled Mealie "In possession". No changes were needed.';
  }

  const updatedLabel = `${updatedProducts} product${updatedProducts === 1 ? '' : 's'}`;
  const enabledLabel = `${enabledProducts} enabled`;
  const disabledLabel = `${disabledProducts} disabled`;

  return `Reconciled Mealie "In possession" for ${updatedLabel} (${enabledLabel}, ${disabledLabel}).`;
}

export async function POST() {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'reconcile_in_possession',
      status: 'skipped',
      message: 'A sync is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'reconcile-in-possession',
          message: 'In possession reconcile skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record in possession skip:', error));

    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 },
    );
  }

  try {
    const result = await reconcileMealieInPossessionFromGrocy();
    const historyOutcome = buildInPossessionHistoryOutcome(result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'reconcile_in_possession',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record in possession reconcile:', error));

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'An internal error occurred during the Mealie "In possession" reconcile' },
        { status: 500 },
      );
    }

    const responseStatus = result.summary.failedProducts > 0 ? 'partial' : 'ok';
    const failureMessage = result.summary.failedProducts > 0
      ? ` Failed ${result.summary.failedProducts} product${result.summary.failedProducts === 1 ? '' : 's'}.`
      : '';

    return NextResponse.json({
      status: responseStatus,
      message: `${formatReconcileMessage(
        result.summary.updatedProducts,
        result.summary.enabledProducts,
        result.summary.disabledProducts,
      )}${failureMessage}`,
      summary: result.summary,
    });
  } catch (error) {
    log.error('[API] Mealie "In possession" reconcile failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'reconcile_in_possession',
      status: 'failure',
      message: 'An internal error occurred during the in possession reconcile.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'sync',
          entityKind: 'system',
          entityRef: 'reconcile-in-possession',
          message: 'In possession reconcile failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record in possession failure:', historyError));

    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during the Mealie "In possession" reconcile' },
      { status: 500 },
    );
  } finally {
    releaseSyncLock();
  }
}
