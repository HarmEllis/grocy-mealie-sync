import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { unitMappings } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync/mutex';

const unitUnmapRequestSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  if (!acquireSyncLock()) {
    return NextResponse.json(
      { error: 'A sync operation is already in progress. Please try again.' },
      { status: 409 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = unitUnmapRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const [existingMapping] = await db.select()
      .from(unitMappings)
      .where(eq(unitMappings.id, parsed.data.id))
      .limit(1);

    if (!existingMapping) {
      return NextResponse.json({ error: 'Unit mapping not found' }, { status: 404 });
    }

    await db.delete(unitMappings).where(eq(unitMappings.id, parsed.data.id));

    return NextResponse.json({
      status: 'ok',
      unmapped: true,
      id: parsed.data.id,
    });
  } catch (error) {
    log.error('[MappingWizard] Unit unmap failed:', error);
    return NextResponse.json({ error: 'Failed to unmap unit' }, { status: 500 });
  } finally {
    releaseSyncLock();
  }
}
