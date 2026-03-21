import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productMappings } from '@/lib/db/schema';

export async function GET() {
  const mappings = await db.select().from(productMappings);
  return NextResponse.json(mappings);
}
