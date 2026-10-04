import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ConversionLibraryError } from '@/lib/use-cases/conversions/library';
import { SyncLockTimeoutError } from '@/lib/use-cases/shared/sync-lock';
import { log } from '@/lib/logger';
import { ConversionConflictError } from '@/lib/use-cases/conversions/manage';

export async function conversionResponse(operation: () => Promise<unknown>) {
  try { return NextResponse.json(await operation()); }
  catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid conversion request.', details: error.issues }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    if (error instanceof ConversionLibraryError) return NextResponse.json({ error: error.message, code: error.code, preview: error.preview }, { status: error.code === 'INVALID_SELECTION' ? 400 : 409 });
    if (error instanceof ConversionConflictError) return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    if (error instanceof SyncLockTimeoutError) return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    log.error('[Conversions] Request failed:', error);
    return NextResponse.json({ error: 'Could not complete this request. Check the connection to Grocy and Mealie, then retry.' }, { status: 500 });
  }
}
