import { NextResponse } from 'next/server';
import { pollMealieForCheckedItems } from '@/lib/sync/mealie-to-grocy';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    await pollMealieForCheckedItems();
    return NextResponse.json({ status: 'ok', message: 'Mealie→Grocy check completed' });
  } catch (error) {
    log.error('[API] Mealie→Grocy sync failed:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
