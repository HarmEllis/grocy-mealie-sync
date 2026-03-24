import { NextResponse } from 'next/server';
import { normalizeUnits } from '@/lib/sync/normalize';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';
import { log } from '@/lib/logger';

export async function POST() {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  try {
    const result = await normalizeUnits();
    log.info(`[MappingWizard] Units normalized: Mealie ${result.normalizedMealie}, Grocy ${result.normalizedGrocy}`);
    return NextResponse.json(result);
  } catch (error) {
    log.error('[MappingWizard] Unit normalization failed:', error);
    return NextResponse.json({ error: 'Unit normalization failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
