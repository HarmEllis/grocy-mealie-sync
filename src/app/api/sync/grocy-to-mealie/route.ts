import { NextResponse } from 'next/server';
import { pollGrocyForMissingStock } from '@/lib/sync/grocy-to-mealie';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    await pollGrocyForMissingStock();
    return NextResponse.json({ status: 'ok', message: 'Grocy→Mealie check completed' });
  } catch (error) {
    log.error('[API] Grocy→Mealie sync failed:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
