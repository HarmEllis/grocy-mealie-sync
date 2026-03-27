import { NextResponse } from 'next/server';
import { pollMealieForCheckedItems } from '@/lib/sync/mealie-to-grocy';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';

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
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }
  try {
    const result = await pollMealieForCheckedItems();

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
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during Mealie-to-Grocy sync' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
