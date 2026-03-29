import { NextResponse } from 'next/server';
import { normalizeUnits } from '@/lib/sync/normalize';
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
    'mapping_unit_normalize',
    '[History] Failed to record unit normalization:',
  );

  try {
    const result = await normalizeUnits();
    await history.recordSuccess({
      logMessage: `[MappingWizard] Units normalized: Mealie ${result.normalizedMealie}, Grocy ${result.normalizedGrocy}`,
      message: `Normalized ${result.normalizedMealie} Mealie and ${result.normalizedGrocy} Grocy unit name(s).`,
      summary: result,
      events: [
        buildManualHistoryEvent({
          level: 'info',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: 'Normalized mapped unit names.',
          details: result,
        }),
      ],
    });
    return NextResponse.json(result);
  } catch (error) {
    await history.recordFailure({
      logMessage: '[MappingWizard] Unit normalization failed:',
      error,
      message: `Unit normalization failed: ${formatManualActionError(error)}`,
      summary: { error: formatManualActionError(error) },
      events: [
        buildManualHistoryEvent({
          level: 'error',
          category: 'mapping',
          entityKind: 'unit',
          entityRef: 'units',
          message: 'Unit normalization failed.',
          details: { error: formatManualActionError(error) },
        }),
      ],
    });
    return NextResponse.json({ error: 'Unit normalization failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
