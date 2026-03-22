import { NextResponse } from 'next/server';
import { runFullProductSync } from '@/lib/sync/product-sync';
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
    await runFullProductSync();
    return NextResponse.json({ status: 'ok', message: 'Product sync completed' });
  } catch (error) {
    log.error('[API] Product sync failed:', error);
    return NextResponse.json(
      { status: 'error', message: 'An internal error occurred during product sync' },
      { status: 500 }
    );
  } finally {
    releaseSyncLock();
  }
}
