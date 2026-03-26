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

export async function POST() {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 },
    );
  }

  try {
    const result = await ensureGrocyMissingStockOnMealie();

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

    const responseStatus = result.summary.unmappedProducts > 0 ? 'partial' : 'ok';
    return NextResponse.json({
      status: responseStatus,
      message: formatEnsureSummaryMessage(
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
