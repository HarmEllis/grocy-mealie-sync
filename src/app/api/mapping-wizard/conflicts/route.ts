import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { listOpenMappingConflicts, runMappingConflictCheck } from '@/lib/mapping-conflicts-store';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { buildConflictCheckHistoryOutcome } from '@/lib/history-events';
import { recordHistoryRun } from '@/lib/history-store';

export async function GET() {
  try {
    const conflicts = await listOpenMappingConflicts();
    return NextResponse.json({ conflicts });
  } catch (error) {
    log.error('[MappingWizard] Failed to fetch conflicts:', error);
    return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
  }
}

export async function POST() {
  const startedAt = new Date();

  if (!acquireSyncLock()) {
    await recordHistoryRun({
      trigger: 'manual',
      action: 'conflict_check',
      status: 'skipped',
      message: 'A sync operation is already in progress.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'warning',
          category: 'conflict',
          entityKind: 'system',
          entityRef: 'conflict-check',
          message: 'Conflict check skipped because another sync is already running.',
        },
      ],
    }).catch(error => log.error('[History] Failed to record conflict check skip:', error));

    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  try {
    const result = await runMappingConflictCheck();
    const historyOutcome = buildConflictCheckHistoryOutcome(result);

    await recordHistoryRun({
      trigger: 'manual',
      action: 'conflict_check',
      status: historyOutcome.status,
      message: historyOutcome.message,
      startedAt,
      finishedAt: new Date(),
      summary: historyOutcome.summary,
      events: historyOutcome.events,
    }).catch(error => log.error('[History] Failed to record conflict check:', error));

    return NextResponse.json(result);
  } catch (error) {
    log.error('[MappingWizard] Conflict check failed:', error);
    await recordHistoryRun({
      trigger: 'manual',
      action: 'conflict_check',
      status: 'failure',
      message: 'Conflict check failed.',
      startedAt,
      finishedAt: new Date(),
      events: [
        {
          level: 'error',
          category: 'conflict',
          entityKind: 'system',
          entityRef: 'conflict-check',
          message: 'Conflict check failed.',
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    }).catch(historyError => log.error('[History] Failed to record conflict check failure:', historyError));

    return NextResponse.json({ error: 'Failed to check conflicts' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
