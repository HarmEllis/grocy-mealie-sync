import { NextResponse } from 'next/server';
import { normalizeProducts } from '@/lib/sync/normalize';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';
import { buildManualHistoryEvent, createManualHistoryRecorder, formatManualActionError } from '@/lib/manual-action-history';

export async function POST() {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  const history = createManualHistoryRecorder(
    'mapping_product_normalize',
    '[History] Failed to record product normalization:',
  );

  try {
    const result = await normalizeProducts();
    await history.recordSuccess({
      logMessage: `[MappingWizard] Products normalized: Mealie ${result.normalizedMealie}, Grocy ${result.normalizedGrocy}`,
      message: `Normalized ${result.normalizedMealie} Mealie and ${result.normalizedGrocy} Grocy product name(s).`,
      summary: result,
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: 'Normalized mapped product names.',
          details: result,
        }),
      ],
    });
    return NextResponse.json(result);
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Product normalization failed:',
      error,
      message: `Product normalization failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'product',
          entityRef: 'products',
          message: 'Product normalization failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Product normalization failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
