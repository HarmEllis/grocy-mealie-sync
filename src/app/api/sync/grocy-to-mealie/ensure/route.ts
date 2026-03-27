import { NextResponse } from 'next/server';
import { ensureGrocyMissingStockOnMealie } from '@/lib/sync/grocy-to-mealie';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';

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
  if (!acquireSyncLock()) {
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
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during Grocy-to-Mealie ensure sync' },
      { status: 500 },
    );
  } finally {
    releaseSyncLock();
  }
}
