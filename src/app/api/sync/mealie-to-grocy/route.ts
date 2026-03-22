import { NextResponse } from 'next/server';
import { pollMealieForCheckedItems } from '@/lib/sync/mealie-to-grocy';
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
    await pollMealieForCheckedItems();
    return NextResponse.json({ status: 'ok', message: 'Mealie→Grocy check completed' });
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
