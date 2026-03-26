import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { reconcileMealieInPossessionFromGrocy } from '@/lib/sync/mealie-in-possession';

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
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 },
    );
  }

  try {
    const result = await reconcileMealieInPossessionFromGrocy();

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
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during the Mealie "In possession" reconcile' },
      { status: 500 },
    );
  } finally {
    releaseSyncLock();
  }
}
