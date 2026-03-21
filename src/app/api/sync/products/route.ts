import { NextResponse } from 'next/server';
import { runFullProductSync } from '@/lib/sync/product-sync';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    await runFullProductSync();
    return NextResponse.json({ status: 'ok', message: 'Product sync completed' });
  } catch (error) {
    log.error('[API] Product sync failed:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
