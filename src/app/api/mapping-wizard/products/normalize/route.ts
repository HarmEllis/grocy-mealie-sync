import { NextResponse } from 'next/server';
import { normalizeProducts } from '@/lib/sync/normalize';
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
    const result = await normalizeProducts();
    log.info(`[MappingWizard] Products normalized: Mealie ${result.normalizedMealie}, Grocy ${result.normalizedGrocy}`);
    return NextResponse.json(result);
  } catch (error) {
    log.error('[MappingWizard] Product normalization failed:', error);
    return NextResponse.json({ error: 'Product normalization failed' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
