import { NextResponse } from 'next/server';
import { pollGrocyForMissingStock } from '@/lib/sync/grocy-to-mealie';

export async function POST() {
  try {
    await pollGrocyForMissingStock();
    return NextResponse.json({ status: 'ok', message: 'Grocy→Mealie check completed' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}
