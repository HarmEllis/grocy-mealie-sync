import { NextResponse } from 'next/server';
import { pollGrocyForMissingStock } from '@/lib/sync/grocy-to-mealie';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';

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
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }
  try {
    const result = await pollGrocyForMissingStock();

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
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during Grocy-to-Mealie sync' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
