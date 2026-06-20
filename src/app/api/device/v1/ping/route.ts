import { NextResponse } from 'next/server';
import { appVersion } from '@/lib/app-info';

export async function GET() {
  return NextResponse.json({ ok: true, app: 'grocy-mealie-sync', version: appVersion });
}
