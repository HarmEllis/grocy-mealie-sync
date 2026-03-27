import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { listOpenMappingConflicts, runMappingConflictCheck } from '@/lib/mapping-conflicts-store';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';

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
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  try {
    const result = await runMappingConflictCheck();
    return NextResponse.json(result);
  } catch (error) {
    log.error('[MappingWizard] Conflict check failed:', error);
    return NextResponse.json({ error: 'Failed to check conflicts' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
