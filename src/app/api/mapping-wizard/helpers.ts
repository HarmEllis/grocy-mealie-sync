import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { SyncLockTimeoutError } from '@/lib/use-cases/shared/sync-lock';

/**
 * Translates mapping-wizard errors into HTTP responses.
 *
 * A held sync lock must surface as a 409 carrying `code: 'SYNC_LOCKED'`: the
 * client chunks bulk actions into many sequential requests and retries that
 * specific condition. Mapping it to a generic 500 (the previous behaviour of
 * `runWithSyncLock`'s bare Error) would make those retries impossible.
 */
export function mappingWizardErrorResponse(error: unknown, logPrefix = '[MappingWizard]'): NextResponse {
  if (error instanceof SyncLockTimeoutError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  }

  log.error(`${logPrefix} Request failed:`, error);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}
