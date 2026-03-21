import { NextResponse } from 'next/server';
import { pollMealieForCheckedItems } from '@/lib/sync/mealie-to-grocy';

export async function POST() {
  try {
    await pollMealieForCheckedItems();
    return NextResponse.json({ status: 'ok', message: 'Mealie→Grocy check completed' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}
