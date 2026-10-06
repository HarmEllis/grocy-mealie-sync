import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Healthy only once startup (migrations, scheduler, plugin gateway) completed. */
export async function GET() {
  if (!globalThis.__gmsInstrumentationReady) {
    return NextResponse.json({ status: 'starting', timestamp: new Date().toISOString() }, { status: 503 });
  }
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
