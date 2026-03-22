import { NextResponse } from 'next/server';
import { pollGrocyForMissingStock } from '@/lib/sync/grocy-to-mealie';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';

export async function POST() {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { status: 'busy', message: 'A sync is already in progress' },
      { status: 409 }
    );
  }
  try {
    await pollGrocyForMissingStock();
    return NextResponse.json({ status: 'ok', message: 'Grocy→Mealie check completed' });
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
