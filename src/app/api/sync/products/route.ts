import { NextResponse } from 'next/server';
import { runFullProductSync } from '@/lib/sync/product-sync';

export async function POST() {
  try {
    await runFullProductSync();
    return NextResponse.json({ status: 'ok', message: 'Product sync completed' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}
