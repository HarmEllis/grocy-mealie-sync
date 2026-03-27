import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { clearSyncLock } from '@/lib/sync/mutex';

export async function POST() {
  try {
    const cleared = clearSyncLock();

    if (!cleared) {
      return NextResponse.json({
        status: 'skipped',
        message: 'No sync lock was present.',
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Sync lock cleared.',
    });
  } catch (error) {
    log.error('[API] Sync unlock failed:', error);
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred while clearing the sync lock' },
      { status: 500 },
    );
  }
}
