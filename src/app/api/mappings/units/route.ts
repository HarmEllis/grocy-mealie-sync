import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';

export async function GET() {
  const mappings = await db.select().from(unitMappings);
  return NextResponse.json(mappings);
}
