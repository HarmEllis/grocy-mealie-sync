import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { clearSchedulerLock, clearSyncLock } from '@/lib/sync/mutex';

export async function POST() {
  try {
    const clearedSyncLock = clearSyncLock();
    const clearedSchedulerLock = clearSchedulerLock();
    const cleared = clearedSyncLock || clearedSchedulerLock;

    if (!cleared) {
      return NextResponse.json({
        status: 'skipped',
        message: 'No sync locks were present.',
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Sync locks cleared.',
    });
  } catch (error) {
    log.error('[API] Sync unlock failed:', error);
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred while clearing the sync locks' },
      { status: 500 },
    );
  }
}
